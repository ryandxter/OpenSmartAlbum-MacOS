export interface ExportOptions {
  format: 'jpeg' | 'png' | 'tiff' | 'pdf' | 'psd';
  dpi: number;
  jpegQuality: number;
  includeBleed: boolean;
  splitPages: boolean;
  sharpenEnabled?: boolean;
  sharpenAmount?: 'standard' | 'high';
  outputDir: string;
  selectedSpreadIds?: string[];
  selectedPageNumbers?: number[];
  filePrefix?: string;
  // Prepress & Layered extensions
  tiffBitDepth?: 8 | 16;
  tiffCompression?: 'lzw' | 'none';
  pdfPrintReady?: boolean;
  slugMm?: number;
  cropMarks?: boolean;
}

export interface MissingPhotoInfo {
  elementId: string;
  spreadName: string;
  filePath: string;
  fileName: string;
  hasPreview: boolean;
}

export interface PreflightReport {
  totalPhotos: number;
  missingPhotos: MissingPhotoInfo[];
  existingFiles: string[];
  destinationWritable: boolean;
  destinationError: string | null;
}

/**
 * Parses range strings like "3-6", "1, 3, 5-8" into sorted unique integers.
 */
export function parseRange(input: string, maxVal: number): number[] {
  const result = new Set<number>();
  const parts = input.split(',').map((p) => p.trim()).filter(Boolean);

  for (const part of parts) {
    if (part.includes('-')) {
      const splitArr = part.split('-');
      const startNum = parseInt(splitArr[0]?.trim() || '', 10);
      const endNum = parseInt(splitArr[1]?.trim() || '', 10);
      if (!isNaN(startNum) && !isNaN(endNum)) {
        const start = Math.max(1, Math.min(startNum, endNum));
        const end = Math.min(maxVal, Math.max(startNum, endNum));
        for (let i = start; i <= end; i++) {
          result.add(i);
        }
      }
    } else {
      const num = parseInt(part, 10);
      if (!isNaN(num) && num >= 1 && num <= maxVal) {
        result.add(num);
      }
    }
  }

  return Array.from(result).sort((a, b) => a - b);
}
