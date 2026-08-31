import "server-only";

import languageData from "@tesseract.js-data/eng";
import { createWorker, OEM, PSM, type Worker } from "tesseract.js";
import { ImportParseError } from "./parsers";

export const MAX_OCR_PAGES = 10;
export const MAX_OCR_PAGE_WIDTH = 1_600;
export const MAX_OCR_PAGE_HEIGHT = 2_400;
export const MAX_OCR_PIXELS_PER_PAGE = 3_840_000;
export const MAX_OCR_TOTAL_PIXELS = 30_000_000;
export const MAX_OCR_TEXT = 500_000;
export const MIN_OCR_CONFIDENCE = 75;
export const OCR_TIMEOUT_MS = 90_000;

export type OcrImage = {
  data: Uint8Array;
  pageNumber: number;
  width: number;
  height: number;
};

type WorkerFactory = () => Promise<Worker>;

function localWorker() {
  return createWorker("eng", OEM.LSTM_ONLY, {
    cacheMethod: "none",
    gzip: languageData.gzip,
    langPath: languageData.langPath,
  });
}

function timeoutError() {
  return new ImportParseError(
    "Local OCR took too long. Try a smaller or clearer document.",
    "OCR_TIMEOUT",
  );
}

async function beforeDeadline<T>(
  promise: Promise<T>,
  deadline: number,
  onTimeout?: () => void,
) {
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw timeoutError();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          onTimeout?.();
          reject(timeoutError());
        }, remaining);
        timer.unref?.();
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function validateOcrImages(images: OcrImage[]) {
  if (!images.length)
    throw new ImportParseError(
      "No PDF pages were available for local OCR.",
      "OCR_UNAVAILABLE",
    );
  if (images.length > MAX_OCR_PAGES)
    throw new ImportParseError(
      `Local OCR is limited to ${MAX_OCR_PAGES} pages per import.`,
      "OCR_PAGE_LIMIT",
    );

  let totalPixels = 0;
  for (const image of images) {
    const pixels = image.width * image.height;
    if (
      image.width > MAX_OCR_PAGE_WIDTH ||
      image.height > MAX_OCR_PAGE_HEIGHT ||
      pixels > MAX_OCR_PIXELS_PER_PAGE
    )
      throw new ImportParseError(
        "A scanned PDF page is too large for safe local OCR.",
        "OCR_RASTER_LIMIT",
      );
    totalPixels += pixels;
  }
  if (totalPixels > MAX_OCR_TOTAL_PIXELS)
    throw new ImportParseError(
      "The scanned PDF is too large for safe local OCR.",
      "OCR_RASTER_LIMIT",
    );
}

export async function recognizeOcrImages(
  images: OcrImage[],
  workerFactory: WorkerFactory = localWorker,
) {
  validateOcrImages(images);
  const deadline = Date.now() + OCR_TIMEOUT_MS;
  let worker: Worker | undefined;
  try {
    worker = await beforeDeadline(workerFactory(), deadline);
    await beforeDeadline(
      worker.setParameters({
        preserve_interword_spaces: "1",
        tessedit_pageseg_mode: PSM.AUTO,
        user_defined_dpi: "200",
      }),
      deadline,
      () => void worker?.terminate(),
    );

    const pages: Array<{
      pageNumber: number;
      text: string;
      confidence: number;
    }> = [];
    let textLength = 0;
    for (const image of images) {
      const result = await beforeDeadline(
        worker.recognize(Buffer.from(image.data)),
        deadline,
        () => void worker?.terminate(),
      );
      const text = result.data.text.trim();
      const confidence = result.data.confidence;
      if (!Number.isFinite(confidence) || confidence < MIN_OCR_CONFIDENCE)
        throw new ImportParseError(
          `Local OCR confidence was too low on page ${image.pageNumber}. Use a clearer source file.`,
          "OCR_LOW_CONFIDENCE",
        );
      textLength += text.length;
      if (textLength > MAX_OCR_TEXT)
        throw new ImportParseError(
          "The local OCR output is too large.",
          "OCR_TEXT_LIMIT",
        );
      pages.push({ pageNumber: image.pageNumber, text, confidence });
    }
    const text = pages
      .map((page) => page.text)
      .join("\n\n")
      .trim();
    if (text.length < 40)
      throw new ImportParseError(
        "Local OCR could not read enough reliable text from this PDF.",
        "OCR_INSUFFICIENT_TEXT",
      );
    return {
      text,
      pageCount: pages.length,
      minimumConfidence: Math.min(...pages.map((page) => page.confidence)),
      pages: pages.map((page) => page.pageNumber),
    };
  } catch (error) {
    if (error instanceof ImportParseError) throw error;
    throw new ImportParseError(
      "Local OCR could not process this PDF safely.",
      "OCR_FAILED",
    );
  } finally {
    await worker?.terminate().catch(() => undefined);
  }
}
