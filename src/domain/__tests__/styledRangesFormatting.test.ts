import { describe, it, expect } from 'vitest';
import {
  normalizeHexColor,
  getActiveSelectionFormat,
  normalizeStyledRanges,
  applyHighlightToRange,
  rangesToTextRuns,
  applyStyleToRange,
  DEFAULT_TEXT_STYLE,
  TextStyle,
  StyledRange,
} from '../text';
import { CarouselTextFrame } from '../carousel';
import { useCarouselStore } from '../../stores/carouselStore';

describe('Rich Text Selection & Formatting Engine', () => {
  describe('1. Hex Color Normalization (normalizeHexColor)', () => {
    it('expands 3-digit hex (#RGB) to 6-digit hex (#RRGGBB) when allowThreeDigitExpand is true', () => {
      expect(normalizeHexColor('#F00', true)).toBe('#FF0000');
      expect(normalizeHexColor('#0F0', true)).toBe('#00FF00');
      expect(normalizeHexColor('#00F', true)).toBe('#0000FF');
      expect(normalizeHexColor('abc', true)).toBe('#AABBCC');
    });

    it('returns null for 3-digit hex when allowThreeDigitExpand is false (preventing premature typing flash)', () => {
      expect(normalizeHexColor('#F00', false)).toBeNull();
      expect(normalizeHexColor('abc', false)).toBeNull();
    });

    it('normalizes 6-digit hex strings with or without hash and standardizes to uppercase', () => {
      expect(normalizeHexColor('#0052b4')).toBe('#0052B4');
      expect(normalizeHexColor('0052b4')).toBe('#0052B4');
      expect(normalizeHexColor('#1e293b')).toBe('#1E293B');
      expect(normalizeHexColor('  #FFFFFF  ')).toBe('#FFFFFF');
    });

    it('returns null for invalid hex length or characters', () => {
      expect(normalizeHexColor('#12345')).toBeNull(); // 5 chars
      expect(normalizeHexColor('#1234567')).toBeNull(); // 7 chars
      expect(normalizeHexColor('xyz123')).toBeNull();
      expect(normalizeHexColor('not-a-color')).toBeNull();
      expect(normalizeHexColor('')).toBeNull();
      expect(normalizeHexColor('   ')).toBeNull();
      expect(normalizeHexColor(null)).toBeNull();
      expect(normalizeHexColor(undefined)).toBeNull();
    });
  });

  describe('2. Active Selection Format Extraction (getActiveSelectionFormat)', () => {
    const baseStyle: TextStyle = {
      ...DEFAULT_TEXT_STYLE,
      fontFamily: 'Inter',
      fontSize: 24,
      fontWeight: 'normal',
      fontStyle: 'normal',
      textDecoration: 'none',
      fill: '#1E293B',
      align: 'center',
    };

    it('returns base style when selection is null', () => {
      const format = getActiveSelectionFormat('Hello World', baseStyle, undefined, null);
      expect(format.isSelectionActive).toBe(false);
      expect(format.isCollapsed).toBe(true);
      expect(format.fill).toBe('#1E293B');
      expect(format.isFillMixed).toBe(false);
      expect(format.highlight).toBe('NONE');
      expect(format.isHighlightMixed).toBe(false);
      expect(format.isBold).toBe(false);
      expect(format.isItalic).toBe(false);
      expect(format.isUnderline).toBe(false);
      expect(format.fontFamily).toBe('Inter');
      expect(format.fontSize).toBe(24);
      expect(format.align).toBe('center');
    });

    it('returns collapsed state with base style when start === end', () => {
      const format = getActiveSelectionFormat('Hello World', baseStyle, undefined, { start: 3, end: 3 });
      expect(format.isSelectionActive).toBe(true);
      expect(format.isCollapsed).toBe(true);
      expect(format.fill).toBe('#1E293B');
      expect(format.isFillMixed).toBe(false);
      expect(format.highlight).toBe('NONE');
    });

    it('returns uniform range style when selection is completely within a single styled range', () => {
      const ranges: StyledRange[] = [
        {
          id: 'r1',
          start: 0,
          end: 5,
          fontWeight: 'bold',
          fontStyle: 'italic',
          textDecoration: 'underline',
          fill: '#FF0000',
          highlight: '#FEF08A',
          fontFamily: 'Playfair Display',
          fontSize: 32,
        },
      ];

      const format = getActiveSelectionFormat('Hello World', baseStyle, ranges, { start: 1, end: 4 });
      expect(format.isSelectionActive).toBe(true);
      expect(format.isCollapsed).toBe(false);
      expect(format.isBold).toBe(true);
      expect(format.isItalic).toBe(true);
      expect(format.isUnderline).toBe(true);
      expect(format.fill).toBe('#FF0000');
      expect(format.isFillMixed).toBe(false);
      expect(format.highlight).toBe('#FEF08A');
      expect(format.isHighlightMixed).toBe(false);
      expect(format.fontFamily).toBe('Playfair Display');
      expect(format.fontSize).toBe(32);
    });

    it('detects mixed fill colors across selection spanning two distinct colors', () => {
      const ranges: StyledRange[] = [
        { id: 'r1', start: 0, end: 5, fill: '#FF0000' },
        { id: 'r2', start: 6, end: 11, fill: '#0052B4' },
      ];

      const format = getActiveSelectionFormat('Hello World', baseStyle, ranges, { start: 0, end: 11 });
      expect(format.isFillMixed).toBe(true);
      expect(format.fill).toBe('MIXED');
    });

    it('detects mixed highlights across selection spanning highlighted and unhighlighted text', () => {
      const ranges: StyledRange[] = [
        { id: 'r1', start: 0, end: 5, highlight: '#FEF08A' },
      ];

      const format = getActiveSelectionFormat('Hello World', baseStyle, ranges, { start: 0, end: 11 });
      expect(format.isHighlightMixed).toBe(true);
      expect(format.highlight).toBe('MIXED');
    });

    it('detects mixed bold formatting across selection spanning bold and regular text', () => {
      const ranges: StyledRange[] = [
        { id: 'r1', start: 0, end: 5, fontWeight: 'bold' },
      ];

      const format = getActiveSelectionFormat('Hello World', baseStyle, ranges, { start: 0, end: 11 });
      expect(format.isBold).toBe('MIXED');
      expect(format.isItalic).toBe(false);
      expect(format.isUnderline).toBe(false);
    });

    it('detects mixed font families and font sizes', () => {
      const ranges: StyledRange[] = [
        { id: 'r1', start: 0, end: 5, fontFamily: 'Cinzel', fontSize: 18 },
        { id: 'r2', start: 6, end: 11, fontFamily: 'Montserrat', fontSize: 30 },
      ];

      const format = getActiveSelectionFormat('Hello World', baseStyle, ranges, { start: 0, end: 11 });
      expect(format.fontFamily).toBe('MIXED');
      expect(format.fontSize).toBe('MIXED');
    });

    it('safely handles inverted or out-of-bounds selections by clamping', () => {
      const ranges: StyledRange[] = [
        { id: 'r1', start: 0, end: 5, fill: '#FF0000' },
      ];

      // Inverted selection start > end
      const formatInverted = getActiveSelectionFormat('Hello World', baseStyle, ranges, { start: 5, end: 0 });
      expect(formatInverted.fill).toBe('#FF0000');

      // Out of bounds selection
      const formatOob = getActiveSelectionFormat('Hello World', baseStyle, ranges, { start: -50, end: 999 });
      expect(formatOob.isSelectionActive).toBe(true);
      expect(formatOob.isFillMixed).toBe(true);
    });
  });

  describe('3. Range Normalization & Coalescing (normalizeStyledRanges)', () => {
    it('merges contiguous adjacent ranges with identical properties into a single continuous range', () => {
      const fragmented: StyledRange[] = [
        { id: 'r1', start: 0, end: 5, fill: '#3B82F6' },
        { id: 'r2', start: 5, end: 10, fill: '#3B82F6' },
      ];

      const normalized = normalizeStyledRanges(fragmented);
      expect(normalized).toHaveLength(1);
      expect(normalized[0]).toMatchObject({
        start: 0,
        end: 10,
        fill: '#3B82F6',
      });
    });

    it('removes collapsed and negative ranges where start >= end', () => {
      const withCollapsed: StyledRange[] = [
        { id: 'r1', start: 5, end: 5, fill: '#FF0000' },
        { id: 'r2', start: 8, end: 3, fill: '#FF0000' },
        { id: 'r3', start: 0, end: 4, fill: '#00FF00' },
      ];

      const normalized = normalizeStyledRanges(withCollapsed);
      expect(normalized).toHaveLength(1);
      expect(normalized[0]).toMatchObject({
        start: 0,
        end: 4,
        fill: '#00FF00',
      });
    });

    it('preserves distinct adjacent ranges with different styles intact', () => {
      const distinct: StyledRange[] = [
        { id: 'r1', start: 0, end: 5, fontWeight: 'bold' },
        { id: 'r2', start: 5, end: 10, fontStyle: 'italic' },
      ];

      const normalized = normalizeStyledRanges(distinct);
      expect(normalized).toHaveLength(2);
      expect(normalized[0]?.fontWeight).toBe('bold');
      expect(normalized[1]?.fontStyle).toBe('italic');
    });

    it('removes ranges that have no active styling properties', () => {
      const emptyProps: StyledRange[] = [
        { id: 'r1', start: 0, end: 5 },
        { id: 'r2', start: 6, end: 10, highlight: 'NONE' },
        { id: 'r3', start: 10, end: 15, highlight: 'transparent' },
        { id: 'r4', start: 15, end: 20, fill: '#123456' },
      ];

      const normalized = normalizeStyledRanges(emptyProps);
      expect(normalized).toHaveLength(1);
      expect(normalized[0]).toMatchObject({
        start: 15,
        end: 20,
        fill: '#123456',
      });
    });

    it('applyStyleToRange integrates normalizeStyledRanges to coalesce contiguous matching ranges', () => {
      const initial: StyledRange[] = [{ id: 'r1', start: 0, end: 5, fill: '#0052B4' }];
      const updated = applyStyleToRange(initial, 5, 10, { fill: '#0052B4' });
      expect(updated).toHaveLength(1);
      expect(updated[0]).toMatchObject({
        start: 0,
        end: 10,
        fill: '#0052B4',
      });
    });
  });

  describe('4. Background Highlight Application & Clear (applyHighlightToRange)', () => {
    it('applies background highlight to a specific text slice', () => {
      const ranges: StyledRange[] = [];
      const updated = applyHighlightToRange(ranges, 2, 8, '#FEF08A');

      expect(updated).toHaveLength(1);
      expect(updated[0]).toMatchObject({
        start: 2,
        end: 8,
        highlight: '#FEF08A',
      });
    });

    it('clears highlight cleanly when highlightColor is undefined', () => {
      const existing: StyledRange[] = [
        { id: 'r1', start: 0, end: 10, highlight: '#FEF08A', fontWeight: 'bold' },
      ];

      const cleared = applyHighlightToRange(existing, 3, 7, undefined);
      // Slices into: [0, 3] (bold + highlight), [3, 7] (bold only), [7, 10] (bold + highlight)
      expect(cleared).toHaveLength(3);
      expect(cleared[0]).toMatchObject({ start: 0, end: 3, highlight: '#FEF08A', fontWeight: 'bold' });
      expect(cleared[1]).toMatchObject({ start: 3, end: 7, fontWeight: 'bold' });
      expect(cleared[1]?.highlight).toBeUndefined();
      expect(cleared[2]).toMatchObject({ start: 7, end: 10, highlight: '#FEF08A', fontWeight: 'bold' });
    });

    it('removes highlight range entirely if highlight was the only style property and is cleared', () => {
      const existing: StyledRange[] = [
        { id: 'r1', start: 0, end: 10, highlight: '#FEF08A' },
      ];

      const cleared = applyHighlightToRange(existing, 0, 10, undefined);
      expect(cleared).toHaveLength(0);
    });
  });

  describe('5. Dual-Engine Rich Text Model Parity', () => {
    it('CarouselTextFrame seamlessly converts styledRanges to TextRun tokens using rangesToTextRuns', () => {
      const textFrame: CarouselTextFrame = {
        type: 'text',
        id: 'text-1',
        x: 100,
        y: 100,
        width: 400,
        height: 100,
        text: 'Social Carousel Headline',
        fontSize: 36,
        fontFamily: 'SF Pro Display',
        fontWeight: '700',
        color: '#1E293B',
        align: 'left',
        locked: false,
        styledRanges: [
          { id: 'r1', start: 0, end: 6, fill: '#E11D48', fontWeight: 'bold' },
          { id: 'r2', start: 7, end: 15, highlight: '#FEF08A' },
        ],
      };

      const baseStyle: TextStyle = {
        ...DEFAULT_TEXT_STYLE,
        fontFamily: textFrame.fontFamily,
        fontSize: textFrame.fontSize,
        fontWeight: textFrame.fontWeight as any,
        fill: textFrame.color,
        align: textFrame.align,
      };

      const runs = rangesToTextRuns(textFrame.text, textFrame.styledRanges, baseStyle);
      expect(runs).toHaveLength(4);

      expect(runs[0]).toMatchObject({
        text: 'Social',
        fill: '#E11D48',
        fontWeight: 'bold',
      });

      expect(runs[1]).toMatchObject({
        text: ' ',
      });

      expect(runs[2]).toMatchObject({
        text: 'Carousel',
        highlight: '#FEF08A',
      });

      expect(runs[3]).toMatchObject({
        text: ' Headline',
      });
    });

    it('useCarouselStore updateTextFrame persists styledRanges and rich text styles', () => {
      const store = useCarouselStore.getState();
      store.initializeCarousel('proj-rich-text-1', '1:1', 1);

      // Add a text frame
      store.addTextFrame();
      const current = useCarouselStore.getState().currentCarousel!;
      const textEl = current.slides[0]?.elements.find((el) => el.type === 'text') as CarouselTextFrame;
      expect(textEl).toBeDefined();

      // Update rich text ranges on text frame
      const ranges: StyledRange[] = [
        { id: 'r1', start: 0, end: 3, fill: '#2563EB', fontWeight: 'bold' },
      ];
      useCarouselStore.getState().updateTextFrame(textEl.id, {
        styledRanges: ranges,
        highlight: '#FEF08A',
      });

      const updated = useCarouselStore.getState().currentCarousel!;
      const updatedTextEl = updated.slides[0]?.elements.find((el) => el.id === textEl.id) as CarouselTextFrame;
      expect(updatedTextEl.styledRanges).toEqual(ranges);
      expect(updatedTextEl.highlight).toBe('#FEF08A');
    });
  });
});
