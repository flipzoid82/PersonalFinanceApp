// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createImportFromUpload: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
  requireUser: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/imports/service", () => {
  class ImportServiceError extends Error {}
  class ImportDetectionError extends ImportServiceError {
    constructor(
      message: string,
      readonly fallback: "csv" | "pdf",
    ) {
      super(message);
    }
  }
  return {
    cancelImport: vi.fn(),
    commitImport: vi.fn(),
    createImportFromUpload: mocks.createImportFromUpload,
    deleteImportSource: vi.fn(),
    ImportDetectionError,
    ImportServiceError,
    mapCsvImport: vi.fn(),
    resolveImportAccount: vi.fn(),
    skipImportCandidate: vi.fn(),
    undoImport: vi.fn(),
  };
});

import { uploadImportAction } from "./imports";

describe("import server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "owner-1" });
  });

  it("does not catch the successful review redirect", async () => {
    mocks.createImportFromUpload.mockResolvedValue("import-1");
    const formData = new FormData();
    formData.set(
      "file",
      new File(["synthetic"], "synthetic.csv", { type: "text/csv" }),
    );

    await expect(uploadImportAction(formData)).rejects.toThrow(
      "NEXT_REDIRECT:/settings/imports/import-1",
    );

    expect(mocks.createImportFromUpload).toHaveBeenCalledWith(
      "owner-1",
      expect.any(File),
      undefined,
    );
    expect(mocks.redirect).toHaveBeenCalledOnce();
  });
});
