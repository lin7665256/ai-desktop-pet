import * as pdfjsLib from 'pdfjs-dist';
import type { FileInfo, ExtractionResult } from './types';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url,
).toString();

/**
 * Extract text from a file based on its type.
 * - .txt/.md: decode UTF-8 string directly
 * - .pdf: decode base64 → ArrayBuffer → pdfjs-dist
 */
export async function extractText(
  fileInfo: FileInfo,
  content: string,
  _isBinary: boolean,
): Promise<ExtractionResult> {
  const startTime = performance.now();

  switch (fileInfo.extension.toLowerCase()) {
    case 'txt':
    case 'md':
      return extractPlainText(content, startTime);
    case 'pdf':
      return extractPdfText(content, startTime);
    default:
      throw new Error(`不支持的文件类型: .${fileInfo.extension}`);
  }
}

function extractPlainText(content: string, startTime: number): ExtractionResult {
  return {
    text: content.trim(),
    extractionTimeMs: performance.now() - startTime,
  };
}

async function extractPdfText(
  base64Content: string,
  startTime: number,
): Promise<ExtractionResult> {
  // Decode base64 to ArrayBuffer
  const binaryStr = atob(base64Content);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  // Load PDF
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const pageCount = pdf.numPages;

  // Extract text from each page
  const pages: string[] = [];
  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    pages.push(pageText);
  }

  const text = pages.join('\n\n');

  return {
    text,
    pageCount,
    extractionTimeMs: performance.now() - startTime,
  };
}

/**
 * Check if extracted text is essentially empty
 */
export function isEmpty(result: ExtractionResult): boolean {
  return result.text.trim().length < 10;
}
