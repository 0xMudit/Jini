import { readFile } from "node:fs/promises";
import path from "node:path";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import readXlsxFile from "read-excel-file/node";

export async function extractTextFromFile(filePath: string, mimeType: string, originalName: string) {
  const extension = path.extname(originalName).toLowerCase();

  if (mimeType === "application/pdf" || extension === ".pdf") {
    const buffer = await readFile(filePath);
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const parsed = await parser.getText();
      return parsed.text;
    } finally {
      await parser.destroy();
    }
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    extension === ".docx"
  ) {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  if (extension === ".xlsx") {
    const sheets = await readXlsxFile(filePath);
    return sheets
      .map((sheet) => {
        const rows = sheet.data.map((row) => row.map((cell: unknown) => (cell == null ? "" : String(cell))).join(", "));
        return `Sheet: ${sheet.sheet}\n${rows.join("\n")}`;
      })
      .join("\n\n");
  }

  if (extension === ".csv") {
    return readFile(filePath, "utf-8");
  }

  if (
    mimeType.startsWith("text/") ||
    [".txt", ".md", ".json", ".xml", ".html"].includes(extension)
  ) {
    return readFile(filePath, "utf-8");
  }

  return [
    `File name: ${originalName}`,
    "Readable text could not be extracted from this file type.",
    "Add OCR or a custom parser for this source if it contains important document text.",
  ].join("\n");
}
