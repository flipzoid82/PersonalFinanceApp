// @vitest-environment node

import { describe, expect, it } from "vitest";
import { extractPdfOcrText, extractPdfText } from "./pdf";

function syntheticTextPdf(text: string) {
  const escaped = text
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
  const stream = `BT /F1 12 Tf 72 720 Td (${escaped}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1))
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}

describe("native PDF extraction", () => {
  it("extracts bounded native text without OCR", async () => {
    const result = await extractPdfText(
      syntheticTextPdf("Fidelity brokerage account statement"),
    );
    expect(result.pageCount).toBe(1);
    expect(result.text).toContain("Fidelity brokerage account statement");
  });

  it("returns a safe corrupt-PDF error", async () => {
    await expect(extractPdfText(Buffer.from("not a PDF"))).rejects.toThrow(
      "corrupted or could not be read",
    );
  });

  it("uses bundled server-local OCR for a rendered synthetic page", async () => {
    const result = await extractPdfOcrText(
      syntheticTextPdf(
        "Fidelity brokerage account statement ending balance 10500 dollars",
      ),
    );

    expect(result.pageCount).toBe(1);
    expect(result.text.toLocaleLowerCase()).toContain("fidelity");
    expect(result.minimumConfidence).toBeGreaterThanOrEqual(75);
  }, 100_000);
});
