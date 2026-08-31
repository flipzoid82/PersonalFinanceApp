// @vitest-environment node

import type { Worker } from "tesseract.js";
import { describe, expect, it, vi } from "vitest";
import {
  MAX_OCR_PAGE_HEIGHT,
  MAX_OCR_PAGE_WIDTH,
  recognizeOcrImages,
  validateOcrImages,
  type OcrImage,
} from "./ocr";

const image: OcrImage = {
  data: new Uint8Array([1, 2, 3]),
  pageNumber: 1,
  width: 100,
  height: 100,
};

function worker(confidence: number, text = "synthetic OCR output ".repeat(3)) {
  return {
    recognize: vi.fn().mockResolvedValue({ data: { confidence, text } }),
    setParameters: vi.fn().mockResolvedValue(undefined),
    terminate: vi.fn().mockResolvedValue(undefined),
  } as unknown as Worker;
}

describe("bounded local OCR", () => {
  it("accepts bounded high-confidence output without external services", async () => {
    const localWorker = worker(92);
    const result = await recognizeOcrImages([image], async () => localWorker);

    expect(result).toMatchObject({ pageCount: 1, minimumConfidence: 92 });
    expect(localWorker.terminate).toHaveBeenCalledOnce();
  });

  it("rejects low-confidence OCR instead of guessing", async () => {
    const localWorker = worker(40);
    await expect(
      recognizeOcrImages([image], async () => localWorker),
    ).rejects.toMatchObject({ code: "OCR_LOW_CONFIDENCE" });
    expect(localWorker.terminate).toHaveBeenCalledOnce();
  });

  it("rejects unsafe raster dimensions before OCR", () => {
    expect(() =>
      validateOcrImages([
        {
          ...image,
          width: MAX_OCR_PAGE_WIDTH + 1,
          height: MAX_OCR_PAGE_HEIGHT + 1,
        },
      ]),
    ).toThrow("too large");
  });
});
