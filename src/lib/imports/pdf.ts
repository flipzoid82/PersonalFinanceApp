import "server-only";

import { PDFParse } from "pdf-parse";
import {
  MAX_OCR_PAGE_HEIGHT,
  MAX_OCR_PAGES,
  MAX_OCR_PAGE_WIDTH,
  MAX_OCR_PIXELS_PER_PAGE,
  MAX_OCR_TOTAL_PIXELS,
  recognizeOcrImages,
} from "./ocr";
import { ImportParseError } from "./parsers";

export const MAX_PDF_PAGES = 100;
export const MAX_EXTRACTED_TEXT = 2_000_000;

export async function extractPdfText(bytes: Uint8Array) {
  const parser = new PDFParse({ data: Buffer.from(bytes) });
  try {
    const info = await parser.getInfo();
    if (info.total > MAX_PDF_PAGES)
      throw new ImportParseError(
        `PDF files are limited to ${MAX_PDF_PAGES} pages.`,
        "PDF_PAGE_LIMIT",
      );
    const result = await parser.getText();
    if (result.text.length > MAX_EXTRACTED_TEXT)
      throw new ImportParseError(
        "The extracted PDF text is too large.",
        "PDF_TEXT_LIMIT",
      );
    return { text: result.text, pageCount: info.total };
  } catch (error) {
    if (error instanceof ImportParseError) throw error;
    throw new ImportParseError(
      "The PDF is corrupted or could not be read.",
      "CORRUPT_PDF",
    );
  } finally {
    await parser.destroy();
  }
}

export async function extractPdfOcrText(bytes: Uint8Array) {
  const parser = new PDFParse({ data: Buffer.from(bytes) });
  try {
    const info = await parser.getInfo({ parsePageInfo: true });
    if (info.total > MAX_OCR_PAGES)
      throw new ImportParseError(
        `Local OCR is limited to ${MAX_OCR_PAGES} pages per import.`,
        "OCR_PAGE_LIMIT",
      );

    let totalPixels = 0;
    for (const page of info.pages) {
      const height = Math.ceil(page.height * (MAX_OCR_PAGE_WIDTH / page.width));
      const pixels = MAX_OCR_PAGE_WIDTH * height;
      if (
        !Number.isFinite(height) ||
        height > MAX_OCR_PAGE_HEIGHT ||
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

    const screenshots = await parser.getScreenshot({
      desiredWidth: MAX_OCR_PAGE_WIDTH,
      imageBuffer: true,
      imageDataUrl: false,
    });
    return await recognizeOcrImages(screenshots.pages);
  } catch (error) {
    if (error instanceof ImportParseError) throw error;
    throw new ImportParseError(
      "The PDF could not be rendered for safe local OCR.",
      "OCR_FAILED",
    );
  } finally {
    await parser.destroy();
  }
}
