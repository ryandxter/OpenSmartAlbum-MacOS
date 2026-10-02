import { describe, it, expect } from 'vitest';
import {
  TextStyle,
  DEFAULT_TEXT_STYLE,
  StyledRange,
  TextNodeElement,
  getActiveSelectionFormat,
  applyStyleToRange,
  applyHighlightToRange,
  rangesToTextRuns,
  getTextRuns,
  layoutRichText,
  updateRangesForTextChange,
} from '../../../domain/text';
import { CarouselTextFrame } from '../../../domain/carousel';
import { useCarouselStore } from '../../../stores/carouselStore';
import { useAlbumStore } from '../../../stores/albumStore';
import { useEditorStore } from '../../../stores/editorStore';
import { useProjectStore } from '../../../stores/projectStore';
import { createInitialAlbum } from '../../../domain/album';
import { Project } from '../../../domain/project';

describe('TextInlineEditor Dual-Engine Parity & Rich Text Suite', () => {
  const baseStyle: TextStyle = {
    ...DEFAULT_TEXT_STYLE,
    fontFamily: 'Inter',
    fontSize: 24,
    fontWeight: 'normal',
    fontStyle: 'normal',
    textDecoration: 'none',
    fill: '#1E293B',
    align: 'left',
  };

  describe('1. Active Format Detection during Editing', () => {
    const text = 'The quick brown fox jumps over the lazy dog';
    // 'quick' is [4, 9], 'brown' is [10, 15]

    it('detects single uniform color when selection is within a styled range', () => {
      const ranges: StyledRange[] = [
        { id: 'r1', start: 4, end: 9, fill: '#FF0000' },
      ];
      const format = getActiveSelectionFormat(text, baseStyle, ranges, { start: 4, end: 9 });
      expect(format.isSelectionActive).toBe(true);
      expect(format.isCollapsed).toBe(false);
      expect(format.fill).toBe('#FF0000');
      expect(format.isFillMixed).toBe(false);
    });

    it('detects mixed fill colors across selection spanning two distinct colors', () => {
      const ranges: StyledRange[] = [
        { id: 'r1', start: 4, end: 9, fill: '#FF0000' },
        { id: 'r2', start: 10, end: 15, fill: '#0052B4' },
      ];
      const format = getActiveSelectionFormat(text, baseStyle, ranges, { start: 4, end: 15 });
      expect(format.isFillMixed).toBe(true);
      expect(format.fill).toBe('MIXED');
    });

    it('detects bold state for bold range and mixed bold state across mixed range', () => {
      const ranges: StyledRange[] = [
        { id: 'r1', start: 4, end: 9, fontWeight: 'bold' },
      ];
      const boldFormat = getActiveSelectionFormat(text, baseStyle, ranges, { start: 4, end: 9 });
      expect(boldFormat.isBold).toBe(true);

      const mixedBoldFormat = getActiveSelectionFormat(text, baseStyle, ranges, { start: 0, end: 9 });
      expect(mixedBoldFormat.isBold).toBe('MIXED');
    });

    it('detects highlight background color and mixed highlight state', () => {
      const ranges: StyledRange[] = [
        { id: 'r1', start: 4, end: 9, highlight: '#FEF08A' },
      ];
      const hlFormat = getActiveSelectionFormat(text, baseStyle, ranges, { start: 4, end: 9 });
      expect(hlFormat.highlight).toBe('#FEF08A');
      expect(hlFormat.isHighlightMixed).toBe(false);

      const mixedHlFormat = getActiveSelectionFormat(text, baseStyle, ranges, { start: 0, end: 9 });
      expect(mixedHlFormat.highlight).toBe('MIXED');
      expect(mixedHlFormat.isHighlightMixed).toBe(true);
    });

    it('detects mixed font sizes when selection spans multiple sizes', () => {
      const ranges: StyledRange[] = [
        { id: 'r1', start: 4, end: 9, fontSize: 18 },
        { id: 'r2', start: 10, end: 15, fontSize: 36 },
      ];
      const format = getActiveSelectionFormat(text, baseStyle, ranges, { start: 4, end: 15 });
      expect(format.fontSize).toBe('MIXED');
    });

    it('returns uniform base format for collapsed cursor', () => {
      const format = getActiveSelectionFormat(text, baseStyle, undefined, { start: 5, end: 5 });
      expect(format.isCollapsed).toBe(true);
      expect(format.fill).toBe('#1E293B');
      expect(format.highlight).toBe('NONE');
      expect(format.isBold).toBe(false);
    });
  });

  describe('2. Zero-Blur Formatting & Range Safety', () => {
    const text = 'Hello World Album';

    it('applying color to range [6, 11] ("World") modifies only characters 6-11 without altering outside ranges', () => {
      const initialRanges: StyledRange[] = [];
      const updated = applyStyleToRange(initialRanges, 6, 11, { fill: '#3B82F6' });

      expect(updated).toHaveLength(1);
      expect(updated[0]).toMatchObject({
        start: 6,
        end: 11,
        fill: '#3B82F6',
      });

      // Verify text tokenization: 0-6 (base), 6-11 (blue), 11-17 (base)
      const runs = getTextRuns(text, baseStyle, updated);
      expect(runs).toHaveLength(3);
      expect(runs[0]).toMatchObject({ text: 'Hello ', fill: '#1E293B' });
      expect(runs[1]).toMatchObject({ text: 'World', fill: '#3B82F6' });
      expect(runs[2]).toMatchObject({ text: ' Album', fill: '#1E293B' });
    });

    it('clearing highlight on a slice preserves surrounding text color and styles', () => {
      const ranges: StyledRange[] = [
        { id: 'r1', start: 0, end: 17, highlight: '#FEF08A', fontWeight: 'bold', fill: '#EF4444' },
      ];

      // Clear highlight on 'World' [6, 11]
      const cleared = applyHighlightToRange(ranges, 6, 11, undefined);

      // Slices: [0, 6] (hl + bold + red), [6, 11] (bold + red, no hl), [11, 17] (hl + bold + red)
      expect(cleared).toHaveLength(3);
      expect(cleared[0]).toMatchObject({ start: 0, end: 6, highlight: '#FEF08A', fontWeight: 'bold', fill: '#EF4444' });
      expect(cleared[1]).toMatchObject({ start: 6, end: 11, fontWeight: 'bold', fill: '#EF4444' });
      expect(cleared[1]?.highlight).toBeUndefined();
      expect(cleared[2]).toMatchObject({ start: 11, end: 17, highlight: '#FEF08A', fontWeight: 'bold', fill: '#EF4444' });
    });

    it('handles overlapping formatting passes cleanly without fragment corruption', () => {
      // 1. Apply bold to [0, 11] ("Hello World")
      let ranges = applyStyleToRange([], 0, 11, { fontWeight: 'bold' });
      // 2. Apply blue color to [6, 17] ("World Album")
      ranges = applyStyleToRange(ranges, 6, 17, { fill: '#2563EB' });

      // Slices should resolve to non-overlapping tokens
      const runs = getTextRuns(text, baseStyle, ranges);
      expect(runs).toHaveLength(3);
      expect(runs[0]).toMatchObject({ text: 'Hello ', fontWeight: 'bold', fill: '#1E293B' });
      expect(runs[1]).toMatchObject({ text: 'World', fontWeight: 'bold', fill: '#2563EB' });
      expect(runs[2]).toMatchObject({ text: ' Album', fontWeight: 'normal', fill: '#2563EB' });
    });
  });

  describe('3. Intra-Session Undo Stack & Keystroke Safety', () => {
    it('shifts range offsets correctly when text is typed or deleted', () => {
      const initialText = 'Hello World';
      const ranges: StyledRange[] = [
        { id: 'r1', start: 6, end: 11, fill: '#3B82F6' }, // 'World'
      ];

      // Insert 'Beautiful ' at index 6
      const insertedText = 'Hello Beautiful World';
      const shifted = updateRangesForTextChange(ranges, initialText, insertedText);
      expect(shifted).toHaveLength(1);
      expect(shifted[0]).toMatchObject({
        start: 16,
        end: 21,
        fill: '#3B82F6',
      });
      expect(insertedText.slice(shifted[0]?.start ?? 0, shifted[0]?.end ?? 0)).toBe('World');
    });

    it('local undo stack manages intra-session steps before commit', () => {
      const past: Array<{ text: string; ranges: StyledRange[] }> = [];
      let current = { text: 'Hello', ranges: [] as StyledRange[] };

      // Step 1: user types ' World'
      past.push(current);
      current = { text: 'Hello World', ranges: [] };

      // Step 2: user formats 'World' with bold
      past.push(current);
      current = {
        text: 'Hello World',
        ranges: applyStyleToRange(current.ranges, 6, 11, { fontWeight: 'bold' }),
      };

      expect(current.ranges).toHaveLength(1);
      expect(past).toHaveLength(2);

      // Undo step 2 (formatting undone)
      const prevStep = past.pop()!;
      current = prevStep;
      expect(current.ranges).toHaveLength(0);
      expect(current.text).toBe('Hello World');

      // Undo step 1 (typing undone)
      const firstStep = past.pop()!;
      current = firstStep;
      expect(current.text).toBe('Hello');
    });
  });

  describe('4. Dual-Engine Text Parity (Print Album & Social Carousel)', () => {
    it('Print Album TextNodeElement and Social Carousel CarouselTextFrame tokenize to identical TextRun tokens', () => {
      const sharedText = 'Dual Engine Parity Title';
      const sharedRanges: StyledRange[] = [
        { id: 'r1', start: 0, end: 11, fill: '#E11D48', fontWeight: 'bold' },
        { id: 'r2', start: 12, end: 18, highlight: '#FEF08A', fontStyle: 'italic' },
      ];

      // 1. Print Album Text Element
      const printElement: TextNodeElement = {
        id: 'text-print-1',
        type: 'text',
        text: sharedText,
        x: 10,
        y: 10,
        width: 100,
        height: 20,
        rotation: 0,
        style: {
          ...baseStyle,
          fontSize: 32,
          fontFamily: 'Playfair Display',
          fill: '#0F172A',
        },
        styledRanges: sharedRanges,
      };

      // 2. Social Carousel Text Frame
      const carouselFrame: CarouselTextFrame = {
        type: 'text',
        id: 'text-carousel-1',
        x: 100,
        y: 100,
        width: 800,
        height: 100,
        text: sharedText,
        fontSize: 32,
        fontFamily: 'Playfair Display',
        fontWeight: 'normal',
        color: '#0F172A',
        align: 'left',
        locked: false,
        styledRanges: sharedRanges,
      };

      const printRuns = getTextRuns(printElement.text, printElement.style, printElement.styledRanges);
      const carouselBaseStyle: TextStyle = {
        ...DEFAULT_TEXT_STYLE,
        fontFamily: carouselFrame.fontFamily,
        fontSize: carouselFrame.fontSize,
        fontWeight: carouselFrame.fontWeight as any,
        fill: carouselFrame.color,
        align: carouselFrame.align,
      };
      const carouselRuns = rangesToTextRuns(carouselFrame.text, carouselFrame.styledRanges, carouselBaseStyle);

      // Runs must match identically in count, text slices, and style properties
      expect(printRuns).toHaveLength(carouselRuns.length);
      for (let i = 0; i < printRuns.length; i++) {
        expect(printRuns[i]?.text).toBe(carouselRuns[i]?.text);
        expect(printRuns[i]?.fill).toBe(carouselRuns[i]?.fill);
        expect(printRuns[i]?.fontWeight).toBe(carouselRuns[i]?.fontWeight);
        expect(printRuns[i]?.fontStyle).toBe(carouselRuns[i]?.fontStyle);
        expect(printRuns[i]?.highlight).toBe(carouselRuns[i]?.highlight);
      }
    });

    it('both engines generate identical layout geometry using layoutRichText', () => {
      const text = 'Header Line 1\nSecond Line with Highlights';
      const ranges: StyledRange[] = [
        { id: 'r1', start: 0, end: 6, fill: '#3B82F6', fontWeight: 'bold' },
        { id: 'r2', start: 26, end: 36, highlight: '#BBF7D0' },
      ];

      const style: TextStyle = {
        ...baseStyle,
        fontSize: 28,
        lineHeight: 1.3,
        letterSpacing: 0,
      };

      const runs = rangesToTextRuns(text, ranges, style);
      const layout1 = layoutRichText(runs, style, 600, 200, 72, 'inch', 72);
      const layout2 = layoutRichText(runs, style, 600, 200, 72, 'inch', 72);

      expect(layout1.lines.length).toBe(layout2.lines.length);
      expect(layout1.totalHeight).toBe(layout2.totalHeight);
      expect(layout1.overflow).toBe(false);
      expect(layout2.overflow).toBe(false);
    });

    it('useCarouselStore correctly persists text updates and maintains history snapshots', () => {
      const cStore = useCarouselStore.getState();
      cStore.initializeCarousel('test-carousel-p1', '1:1', 2);
      cStore.addTextFrame();

      const carousel = useCarouselStore.getState().currentCarousel!;
      const textEl = carousel.slides[0]?.elements.find((e) => e.type === 'text') as CarouselTextFrame;
      expect(textEl).toBeDefined();

      const newRanges: StyledRange[] = [
        { id: 'r-head', start: 0, end: 3, fill: '#EF4444', fontWeight: 'bold' },
      ];

      useCarouselStore.getState().updateTextFrame(textEl.id, {
        text: 'New Headline',
        styledRanges: newRanges,
        color: '#10B981',
      });

      const updatedCarousel = useCarouselStore.getState().currentCarousel!;
      const updatedText = updatedCarousel.slides[0]?.elements.find((e) => e.id === textEl.id) as CarouselTextFrame;
      expect(updatedText.text).toBe('New Headline');
      expect(updatedText.styledRanges).toEqual(newRanges);
      expect(updatedText.color).toBe('#10B981');

      // Undo restores original text
      expect(useCarouselStore.getState().canUndo).toBe(true);
      useCarouselStore.getState().undo();
      const undoneCarousel = useCarouselStore.getState().currentCarousel!;
      const undoneText = undoneCarousel.slides[0]?.elements.find((e) => e.id === textEl.id) as CarouselTextFrame;
      expect(undoneText.text).toBe('Add your text here');
    });

    it('useAlbumStore and useEditorStore persist rich text styledRanges on spread text elements', () => {
      const mockProject: Project = {
        id: 'album-parity-1',
        name: 'Parity Project',
        canvasWidth: 400,
        canvasHeight: 200,
        canvasUnit: 'mm',
        canvasDpi: 300,
        spacingValue: 5,
        spacingUnit: 'mm',
        borderEnabled: false,
        borderWidth: 0,
        borderUnit: 'mm',
        borderColor: '#000000',
        backgroundType: 'solid',
        backgroundColor: '#FFFFFF',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockAlbum = createInitialAlbum(mockProject);
      const textNode: TextNodeElement = {
        id: 'text-node-1',
        type: 'text',
        text: 'Album Spread Text',
        x: 20,
        y: 20,
        width: 120,
        height: 30,
        rotation: 0,
        style: { ...baseStyle },
        styledRanges: [],
      };

      // Add text node to spread 1
      mockAlbum.spreads[0]!.elements.push(textNode);

      useAlbumStore.setState({ currentAlbum: mockAlbum });
      useProjectStore.setState({ currentProject: mockProject });

      const ranges: StyledRange[] = [
        { id: 'r1', start: 0, end: 5, fill: '#3B82F6', fontWeight: 'bold' },
      ];

      const spreadId = mockAlbum.spreads[0]!.id;
      useEditorStore.getState().updateTextElement(spreadId, 'text-node-1', {
        text: 'Album Spread Text',
        styledRanges: ranges,
      });

      const currentAlbum = useAlbumStore.getState().currentAlbum!;
      const textElem = currentAlbum.spreads[0]?.elements.find((e) => e.id === 'text-node-1') as TextNodeElement;
      expect(textElem.styledRanges).toEqual(ranges);
      expect(textElem.text).toBe('Album Spread Text');
    });
  });
});
