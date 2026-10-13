/**
 * CSV building for HR exports. The output targets French-locale spreadsheet
 * software: semicolon separator, comma decimal separator and a UTF-8 BOM so
 * Excel picks up the encoding.
 */
const SEPARATOR = ";"

export function formatCsvNumber(value: number): string {
  return String(Math.round(value * 100) / 100).replace(".", ",")
}

function escapeCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ""
  const text =
    typeof value === "number" ? formatCsvNumber(value) : String(value)
  if (/[";\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

export function toCsv(
  rows: (string | number | null | undefined)[][]
): string {
  const body = rows
    .map((row) => row.map((cell) => escapeCell(cell)).join(SEPARATOR))
    .join("\r\n")
  return `\uFEFF${body}\r\n`
}

export interface CsvFile {
  filename: string
  content: string
}
