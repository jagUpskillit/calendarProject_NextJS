"use client";

import { parseBeCogCsvFile } from "@/lib/import/parseBeCogCsv";
import { parseBeCogXlsxFile } from "@/lib/import/parseBeCogXlsx";

/**
 * Compile-time smoke component proving parser modules are client-importable.
 * Not rendered in UI; used only to keep browser-safe imports verified.
 */
export function ImportParserClientSmoke() {
  void parseBeCogCsvFile;
  void parseBeCogXlsxFile;
  return null;
}
