import { TextStyle, StyledRange } from './text';
import { generateRangeId } from './styledRanges';

export interface ActiveSelectionFormat {
  isSelectionActive: boolean;
  isCollapsed: boolean;
  // Color & Highlight
  fill: string | 'MIXED';
  isFillMixed: boolean;
  highlight: string | 'MIXED' | 'NONE';
  isHighlightMixed: boolean;
  // Font & Style
  isBold: boolean | 'MIXED';
  isItalic: boolean | 'MIXED';
  isUnderline: boolean | 'MIXED';
  fontFamily: string | 'MIXED';
  fontSize: number | 'MIXED';
  align: 'left' | 'center' | 'right' | 'justify';
}

/**
 * Normalizes input string to uppercase #RRGGBB or returns null if invalid.
 * If allowThreeDigitExpand is true, expands 3-digit hex (#RGB -> #RRGGBB).
 * If false, only accepts 6-digit hex (used during active typing to prevent flashing).
 */
export function normalizeHexColor(input: string | null | undefined, allowThreeDigitExpand: boolean = true): string | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  const hexOnly = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;

  if (hexOnly.length === 3) {
    if (!/^[0-9A-Fa-f]{3}$/.test(hexOnly)) return null;
    if (!allowThreeDigitExpand) return null;
    const r = hexOnly[0]!;
    const g = hexOnly[1]!;
    const b = hexOnly[2]!;
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }

  if (hexOnly.length === 6) {
    if (!/^[0-9A-Fa-f]{6}$/.test(hexOnly)) return null;
    return `#${hexOnly}`.toUpperCase();
  }

  return null;
}

/**
 * Checks if two ranges have identical styling attributes.
 */
export function areRangeStylesEqual(
  a: Partial<StyledRange>,
  b: Partial<StyledRange>
): boolean {
  return (
    a.fontFamily === b.fontFamily &&
    a.fontSize === b.fontSize &&
    a.fontWeight === b.fontWeight &&
    a.fontStyle === b.fontStyle &&
    a.textDecoration === b.textDecoration &&
    a.fill === b.fill &&
    a.highlight === b.highlight
  );
}

/**
 * Checks if a range has at least one explicit style attribute defined.
 */
export function hasActiveStyle(range: Partial<StyledRange>): boolean {
  return Boolean(
    range.fontFamily !== undefined ||
    range.fontSize !== undefined ||
    range.fontWeight !== undefined ||
    range.fontStyle !== undefined ||
    range.textDecoration !== undefined ||
    range.fill !== undefined ||
    (range.highlight !== undefined && range.highlight !== '' && range.highlight !== 'transparent' && range.highlight !== 'NONE')
  );
}

/**
 * Coalesces adjacent ranges with identical formatting properties and removes collapsed ranges.
 */
export function normalizeStyledRanges(ranges: StyledRange[] | undefined): StyledRange[] {
  if (!ranges || ranges.length === 0) return [];

  // 1. Filter out collapsed or negative ranges and ranges without effective styles
  const valid: StyledRange[] = [];
  for (const r of ranges) {
    if (!r || typeof r.start !== 'number' || typeof r.end !== 'number') continue;
    const start = Math.round(r.start);
    const end = Math.round(r.end);
    if (start >= end || start < 0) continue;

    // Clean highlight if it is empty string or NONE or transparent
    const cleanHighlight =
      r.highlight && r.highlight !== '' && r.highlight !== 'transparent' && r.highlight !== 'NONE'
        ? r.highlight
        : undefined;

    const cleaned: StyledRange = {
      id: r.id || generateRangeId(),
      start,
      end,
      ...(r.fontFamily !== undefined ? { fontFamily: r.fontFamily } : {}),
      ...(r.fontSize !== undefined ? { fontSize: r.fontSize } : {}),
      ...(r.fontWeight !== undefined ? { fontWeight: r.fontWeight } : {}),
      ...(r.fontStyle !== undefined ? { fontStyle: r.fontStyle } : {}),
      ...(r.textDecoration !== undefined ? { textDecoration: r.textDecoration } : {}),
      ...(r.fill !== undefined ? { fill: r.fill } : {}),
      ...(cleanHighlight !== undefined ? { highlight: cleanHighlight } : {}),
    };

    if (hasActiveStyle(cleaned)) {
      valid.push(cleaned);
    }
  }

  if (valid.length === 0) return [];

  // 2. Sort by start ascending, then end ascending
  valid.sort((a, b) => a.start - b.start || a.end - b.end);

  // 3. Merge contiguous adjacent ranges with identical styling properties
  const merged: StyledRange[] = [];
  for (const r of valid) {
    const prev = merged[merged.length - 1];
    if (prev && prev.end === r.start && areRangeStylesEqual(prev, r)) {
      prev.end = r.end;
    } else {
      merged.push({ ...r });
    }
  }

  return merged;
}

/**
 * Helper to determine if a weight represents bold.
 */
function isBoldWeight(weight?: string): boolean {
  return weight === 'bold' || weight === '600' || weight === '700' || weight === '800';
}

/**
 * Extracts unified formatting state across an active text selection slice [start, end].
 * Detects mixed states when selection spans multiple distinct formats.
 */
export function getActiveSelectionFormat(
  text: string,
  baseStyle: TextStyle,
  ranges: StyledRange[] | undefined,
  selection: { start: number; end: number } | null
): ActiveSelectionFormat {
  const defaultAlign = (baseStyle.align as any) || 'left';
  const defaultBold = isBoldWeight(baseStyle.fontWeight);
  const defaultItalic = baseStyle.fontStyle === 'italic';
  const defaultUnderline = baseStyle.textDecoration === 'underline';

  if (!selection) {
    return {
      isSelectionActive: false,
      isCollapsed: true,
      fill: baseStyle.fill,
      isFillMixed: false,
      highlight: 'NONE',
      isHighlightMixed: false,
      isBold: defaultBold,
      isItalic: defaultItalic,
      isUnderline: defaultUnderline,
      fontFamily: baseStyle.fontFamily,
      fontSize: baseStyle.fontSize,
      align: defaultAlign,
    };
  }

  const textLen = text ? text.length : 0;
  const rawS = Math.min(selection.start, selection.end);
  const rawE = Math.max(selection.start, selection.end);

  // Clamped bounds
  const s = Math.max(0, Math.min(textLen, rawS));
  const e = Math.max(0, Math.min(textLen, rawE));

  if (s === e) {
    // Collapsed selection
    return {
      isSelectionActive: true,
      isCollapsed: true,
      fill: baseStyle.fill,
      isFillMixed: false,
      highlight: 'NONE',
      isHighlightMixed: false,
      isBold: defaultBold,
      isItalic: defaultItalic,
      isUnderline: defaultUnderline,
      fontFamily: baseStyle.fontFamily,
      fontSize: baseStyle.fontSize,
      align: defaultAlign,
    };
  }

  // Active non-collapsed selection
  // Compute slices across boundary points in [s, e]
  const validRanges = normalizeStyledRanges(ranges);
  const boundarySet = new Set<number>([s, e]);
  for (const r of validRanges) {
    if (r.start > s && r.start < e) boundarySet.add(r.start);
    if (r.end > s && r.end < e) boundarySet.add(r.end);
  }

  const boundaries = Array.from(boundarySet).sort((a, b) => a - b);

  const fills = new Set<string>();
  const highlights = new Set<string>();
  const bolds = new Set<boolean>();
  const italics = new Set<boolean>();
  const underlines = new Set<boolean>();
  const fontFamilies = new Set<string>();
  const fontSizes = new Set<number>();

  for (let i = 0; i < boundaries.length - 1; i++) {
    const sliceStart = boundaries[i]!;
    const sliceEnd = boundaries[i + 1]!;
    if (sliceStart >= sliceEnd) continue;

    // Find active ranges covering this slice
    const active = validRanges.filter((r) => r.start <= sliceStart && r.end >= sliceEnd);

    let effFill = baseStyle.fill;
    let effHighlight: string = 'NONE';
    let effWeight = baseStyle.fontWeight;
    let effStyle = baseStyle.fontStyle;
    let effDec = baseStyle.textDecoration;
    let effFamily = baseStyle.fontFamily;
    let effSize = baseStyle.fontSize;

    for (const r of active) {
      if (r.fill !== undefined) effFill = r.fill;
      if (r.highlight !== undefined && r.highlight !== '' && r.highlight !== 'transparent' && r.highlight !== 'NONE') {
        effHighlight = r.highlight;
      }
      if (r.fontWeight !== undefined) effWeight = r.fontWeight;
      if (r.fontStyle !== undefined) effStyle = r.fontStyle;
      if (r.textDecoration !== undefined) effDec = r.textDecoration;
      if (r.fontFamily !== undefined) effFamily = r.fontFamily;
      if (r.fontSize !== undefined) effSize = r.fontSize;
    }

    fills.add(effFill);
    highlights.add(effHighlight);
    bolds.add(isBoldWeight(effWeight));
    italics.add(effStyle === 'italic');
    underlines.add(effDec === 'underline');
    fontFamilies.add(effFamily);
    fontSizes.add(effSize);
  }

  const isFillMixed = fills.size > 1;
  const isHighlightMixed = highlights.size > 1;
  const isBoldMixed = bolds.size > 1;
  const isItalicMixed = italics.size > 1;
  const isUnderlineMixed = underlines.size > 1;
  const isFontFamilyMixed = fontFamilies.size > 1;
  const isFontSizeMixed = fontSizes.size > 1;

  return {
    isSelectionActive: true,
    isCollapsed: false,
    fill: isFillMixed ? 'MIXED' : (Array.from(fills)[0] || baseStyle.fill),
    isFillMixed,
    highlight: isHighlightMixed ? 'MIXED' : ((Array.from(highlights)[0] as any) || 'NONE'),
    isHighlightMixed,
    isBold: isBoldMixed ? 'MIXED' : (Array.from(bolds)[0] ?? defaultBold),
    isItalic: isItalicMixed ? 'MIXED' : (Array.from(italics)[0] ?? defaultItalic),
    isUnderline: isUnderlineMixed ? 'MIXED' : (Array.from(underlines)[0] ?? defaultUnderline),
    fontFamily: isFontFamilyMixed ? 'MIXED' : (Array.from(fontFamilies)[0] || baseStyle.fontFamily),
    fontSize: isFontSizeMixed ? 'MIXED' : (Array.from(fontSizes)[0] || baseStyle.fontSize),
    align: defaultAlign,
  };
}

/**
 * Applies or clears text background highlight across a character range.
 */
export function applyHighlightToRange(
  ranges: StyledRange[] | undefined,
  start: number,
  end: number,
  highlightColor: string | undefined
): StyledRange[] {
  const s = Math.min(start, end);
  const e = Math.max(start, end);
  if (s === e) return ranges ? [...ranges] : [];

  const current = ranges ? [...ranges] : [];
  const cleanColor =
    highlightColor && highlightColor !== '' && highlightColor !== 'transparent' && highlightColor !== 'NONE'
      ? highlightColor
      : undefined;

  // Split boundaries across all ranges and [s, e]
  const boundarySet = new Set<number>([s, e]);
  for (const r of current) {
    boundarySet.add(r.start);
    boundarySet.add(r.end);
  }

  const boundaries = Array.from(boundarySet).sort((a, b) => a - b);
  const resultSegments: StyledRange[] = [];

  for (let i = 0; i < boundaries.length - 1; i++) {
    const segStart = boundaries[i]!;
    const segEnd = boundaries[i + 1]!;
    if (segStart >= segEnd) continue;

    // Find active ranges on this segment
    const active = current.filter((r) => r.start <= segStart && r.end >= segEnd);
    const inSelectedRange = segStart >= s && segEnd <= e;

    // Build segment styling
    let fFamily: string | undefined = undefined;
    let fSize: number | undefined = undefined;
    let fWeight: StyledRange['fontWeight'] = undefined;
    let fStyle: StyledRange['fontStyle'] = undefined;
    let tDec: StyledRange['textDecoration'] = undefined;
    let fill: string | undefined = undefined;
    let hl: string | undefined = undefined;

    for (const r of active) {
      if (r.fontFamily !== undefined) fFamily = r.fontFamily;
      if (r.fontSize !== undefined) fSize = r.fontSize;
      if (r.fontWeight !== undefined) fWeight = r.fontWeight;
      if (r.fontStyle !== undefined) fStyle = r.fontStyle;
      if (r.textDecoration !== undefined) tDec = r.textDecoration;
      if (r.fill !== undefined) fill = r.fill;
      if (r.highlight !== undefined) hl = r.highlight;
    }

    if (inSelectedRange) {
      hl = cleanColor; // Set new highlight or clear if undefined
    }

    const seg: StyledRange = {
      id: generateRangeId(),
      start: segStart,
      end: segEnd,
      ...(fFamily !== undefined ? { fontFamily: fFamily } : {}),
      ...(fSize !== undefined ? { fontSize: fSize } : {}),
      ...(fWeight !== undefined ? { fontWeight: fWeight } : {}),
      ...(fStyle !== undefined ? { fontStyle: fStyle } : {}),
      ...(tDec !== undefined ? { textDecoration: tDec } : {}),
      ...(fill !== undefined ? { fill } : {}),
      ...(hl !== undefined ? { highlight: hl } : {}),
    };

    if (hasActiveStyle(seg)) {
      resultSegments.push(seg);
    }
  }

  return normalizeStyledRanges(resultSegments);
}
