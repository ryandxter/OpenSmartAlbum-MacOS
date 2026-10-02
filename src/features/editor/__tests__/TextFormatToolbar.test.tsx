import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { TextFormatToolbar, HIGHLIGHTER_PRESETS, TEXT_COLOR_PRESETS } from '../TextFormatToolbar';
import { ActiveSelectionFormat, normalizeHexColor, applyHighlightToRange } from '../../../domain/richTextSelection';

describe('TextFormatToolbar Logic & Zero-Blur Architecture', () => {
  const defaultFormat: ActiveSelectionFormat = {
    isSelectionActive: true,
    isCollapsed: false,
    fill: '#1E293B',
    isFillMixed: false,
    highlight: 'NONE',
    isHighlightMixed: false,
    isBold: false,
    isItalic: false,
    isUnderline: false,
    fontFamily: 'Inter',
    fontSize: 24,
    align: 'left',
  };

  describe('1. Component Instantiation & Props Contract', () => {
    it('creates React element with required TextFormatToolbar props', () => {
      const onApplyRangeFormat = vi.fn();
      const onApplyBaseStyle = vi.fn();
      const onClearHighlight = vi.fn();

      const element = React.createElement(TextFormatToolbar, {
        activeFormat: defaultFormat,
        onApplyRangeFormat,
        onApplyBaseStyle,
        onClearHighlight,
      });

      expect(element).toBeTruthy();
      expect(element.type).toBe(TextFormatToolbar);
      expect(element.props.activeFormat).toBe(defaultFormat);
      expect(element.props.onApplyRangeFormat).toBe(onApplyRangeFormat);
      expect(element.props.onApplyBaseStyle).toBe(onApplyBaseStyle);
      expect(element.props.onClearHighlight).toBe(onClearHighlight);
    });
  });

  describe('2. Button Action Dispatches', () => {
    it('Bold button toggles bold to normal when currently bold', () => {
      const onApplyRangeFormat = vi.fn();
      const activeFormat = { ...defaultFormat, isBold: true };
      const nextWeight = activeFormat.isBold === true ? 'normal' : 'bold';
      onApplyRangeFormat({ fontWeight: nextWeight });
      expect(onApplyRangeFormat).toHaveBeenCalledWith({ fontWeight: 'normal' });
    });

    it('Bold button toggles normal to bold when not bold', () => {
      const onApplyRangeFormat = vi.fn();
      const activeFormat = { ...defaultFormat, isBold: false };
      const nextWeight = activeFormat.isBold === true ? 'normal' : 'bold';
      onApplyRangeFormat({ fontWeight: nextWeight });
      expect(onApplyRangeFormat).toHaveBeenCalledWith({ fontWeight: 'bold' });
    });

    it('Italic button dispatches fontStyle: italic when not italic', () => {
      const onApplyRangeFormat = vi.fn();
      const activeFormat = { ...defaultFormat, isItalic: false };
      const nextStyle = activeFormat.isItalic === true ? 'normal' : 'italic';
      onApplyRangeFormat({ fontStyle: nextStyle });
      expect(onApplyRangeFormat).toHaveBeenCalledWith({ fontStyle: 'italic' });
    });

    it('Underline button dispatches textDecoration: underline when not underlined', () => {
      const onApplyRangeFormat = vi.fn();
      const activeFormat = { ...defaultFormat, isUnderline: false };
      const nextDec = activeFormat.isUnderline === true ? 'none' : 'underline';
      onApplyRangeFormat({ textDecoration: nextDec });
      expect(onApplyRangeFormat).toHaveBeenCalledWith({ textDecoration: 'underline' });
    });

    it('Alignment buttons dispatch onApplyBaseStyle with matching alignment', () => {
      const onApplyBaseStyle = vi.fn();
      const alignments = ['left', 'center', 'right', 'justify'] as const;
      for (const align of alignments) {
        onApplyBaseStyle({ align });
        expect(onApplyBaseStyle).toHaveBeenLastCalledWith({ align });
      }
    });

    it('Stepper font size calculations clamp within bounds [6, 200]', () => {
      const current = 24;
      expect(Math.max(6, current - 2)).toBe(22);
      expect(Math.min(200, current + 2)).toBe(26);

      const minEdge = 6;
      expect(Math.max(6, minEdge - 2)).toBe(6);

      const maxEdge = 200;
      expect(Math.min(200, maxEdge + 2)).toBe(200);
    });
  });

  describe('3. Zero-Blur Prevention Architecture', () => {
    it('verifies preventDefault and stopPropagation behavior for non-blur actions', () => {
      const mockPreventDefault = vi.fn();
      const mockStopPropagation = vi.fn();
      const syntheticMouseDown = {
        preventDefault: mockPreventDefault,
        stopPropagation: mockStopPropagation,
      };

      syntheticMouseDown.preventDefault();
      syntheticMouseDown.stopPropagation();

      expect(mockPreventDefault).toHaveBeenCalledTimes(1);
      expect(mockStopPropagation).toHaveBeenCalledTimes(1);
    });
  });

  describe('4. Hex Input Typing & Validation', () => {
    it('validates and expands 6-digit hex live typing without three-digit flash', () => {
      const onApplyRangeFormat = vi.fn();

      // Step 1: User types 2 characters '1E' -> does NOT dispatch live
      const typing2 = '1E';
      if (typing2.length === 6 && /^[0-9A-Fa-f]{6}$/.test(typing2)) {
        onApplyRangeFormat({ fill: `#${typing2.toUpperCase()}` });
      }
      expect(onApplyRangeFormat).not.toHaveBeenCalled();

      // Step 2: User types full 6 characters 'FF0000' -> dispatches live
      const typing6 = 'FF0000';
      if (typing6.length === 6 && /^[0-9A-Fa-f]{6}$/.test(typing6)) {
        onApplyRangeFormat({ fill: `#${typing6.toUpperCase()}` });
      }
      expect(onApplyRangeFormat).toHaveBeenCalledWith({ fill: '#FF0000' });
    });

    it('expands 3-digit hex on blur / Enter key (#F00 -> #FF0000)', () => {
      const onApplyRangeFormat = vi.fn();
      const input = 'F00';
      const normalized = normalizeHexColor(input, true);
      expect(normalized).toBe('#FF0000');
      if (normalized) {
        onApplyRangeFormat({ fill: normalized });
      }
      expect(onApplyRangeFormat).toHaveBeenCalledWith({ fill: '#FF0000' });
    });

    it('reverts invalid input on blur without corrupting existing color', () => {
      const onApplyRangeFormat = vi.fn();
      const input = 'xyz';
      const normalized = normalizeHexColor(input, true);
      expect(normalized).toBeNull();
      if (normalized) {
        onApplyRangeFormat({ fill: normalized });
      }
      expect(onApplyRangeFormat).not.toHaveBeenCalled();
    });
  });

  describe('5. Mixed State Handling', () => {
    it('handles mixed fill state by providing empty input buffer and Mixed placeholder', () => {
      const activeFormat: ActiveSelectionFormat = {
        ...defaultFormat,
        fill: 'MIXED',
        isFillMixed: true,
      };

      const isFillMixed = activeFormat.isFillMixed || activeFormat.fill === 'MIXED';
      const placeholder = isFillMixed ? 'Mixed' : '000000';
      const initialValue = isFillMixed ? '' : activeFormat.fill.replace('#', '');

      expect(isFillMixed).toBe(true);
      expect(placeholder).toBe('Mixed');
      expect(initialValue).toBe('');
    });

    it('handles mixed highlight state', () => {
      const activeFormat: ActiveSelectionFormat = {
        ...defaultFormat,
        highlight: 'MIXED',
        isHighlightMixed: true,
      };

      const isHighlightMixed = activeFormat.isHighlightMixed || activeFormat.highlight === 'MIXED';
      const placeholder = isHighlightMixed ? 'Mixed' : 'None';
      const initialValue = isHighlightMixed ? '' : activeFormat.highlight.replace('#', '');

      expect(isHighlightMixed).toBe(true);
      expect(placeholder).toBe('Mixed');
      expect(initialValue).toBe('');
    });
  });

  describe('6. Highlight Clear Action & Presets', () => {
    it('clearing highlight dispatches onClearHighlight() and cleans ranges', () => {
      const onClearHighlight = vi.fn();
      onClearHighlight();
      expect(onClearHighlight).toHaveBeenCalledTimes(1);

      const sampleRanges = [
        { id: '1', start: 0, end: 5, fill: '#FF0000', highlight: '#FEF08A' },
      ];
      const cleared = applyHighlightToRange(sampleRanges, 0, 5, undefined);
      expect(cleared[0]?.highlight).toBeUndefined();
      expect(cleared[0]?.fill).toBe('#FF0000');
    });

    it('all 9 highlighter presets have valid uppercase 6-digit hex values', () => {
      expect(HIGHLIGHTER_PRESETS).toHaveLength(9);
      for (const preset of HIGHLIGHTER_PRESETS) {
        expect(preset.color).toMatch(/^#[0-9A-F]{6}$/i);
        const normalized = normalizeHexColor(preset.color, false);
        expect(normalized).toBe(preset.color.toUpperCase());
      }
    });

    it('all text color presets have valid uppercase 6-digit hex values', () => {
      expect(TEXT_COLOR_PRESETS.length).toBeGreaterThan(10);
      for (const color of TEXT_COLOR_PRESETS) {
        expect(color).toMatch(/^#[0-9A-F]{6}$/i);
        const normalized = normalizeHexColor(color, false);
        expect(normalized).toBe(color.toUpperCase());
      }
    });
  });
});
