import { describe, it, expect } from 'vitest';
import {
  TextNodeElement,
  DEFAULT_TEXT_STYLE,
  fitTextFrame,
  updateTextNode,
} from '../text';

function createMockTextElement(overrides: Partial<TextNodeElement> = {}): TextNodeElement {
  return {
    id: 'text-1',
    type: 'text',
    text: 'OpenSmartAlbum macOS Studio Typography',
    x: 20,
    y: 20,
    width: 100,
    height: 40,
    rotation: 0,
    style: {
      ...DEFAULT_TEXT_STYLE,
      fontSize: 16,
      lineHeight: 1.25,
      letterSpacing: 0.5,
      align: 'justify',
    },
    ...overrides,
  };
}

describe('Typography & Text Frame Parity (EXP-05)', () => {
  it('supports align: "justify" and letterSpacing properties', () => {
    const el = createMockTextElement();
    expect(el.style.align).toBe('justify');
    expect(el.style.letterSpacing).toBe(0.5);
    expect(el.style.lineHeight).toBe(1.25);
  });

  it('fitTextFrame hugs content width and height in "content" mode', () => {
    const el = createMockTextElement({
      text: 'Short headline',
      width: 1000,
      height: 200,
    });

    const fitted = fitTextFrame(el, 'content', 'px', 300, 1200);
    expect(fitted.width).toBeDefined();
    expect(fitted.height).toBeDefined();
    expect(fitted.width).toBeGreaterThan(0);
    expect(fitted.height).toBeGreaterThan(0);
    // Should hug tightly instead of remaining 1000x200
    expect(fitted.width).toBeLessThan(1000);
  });

  it('fitTextFrame preserves frame width and only adjusts height in "height" mode', () => {
    const el = createMockTextElement({
      text: 'A long paragraph with multiple words that will wrap into several lines across the specified column width.',
      width: 80,
      height: 20,
    });

    const fitted = fitTextFrame(el, 'height', 'px', 300);
    expect(fitted.width).toBe(80);
    expect(fitted.height).toBeGreaterThan(20);
  });

  it('updateTextNode auto-resizes height when autoSize is set to "height"', () => {
    const el = createMockTextElement({
      style: { ...DEFAULT_TEXT_STYLE, autoSize: 'height' },
      width: 100,
      height: 10,
    });

    const updated = updateTextNode(el, { text: 'Line 1\nLine 2\nLine 3' }, 'px', 300);
    expect(updated.height).toBeGreaterThan(10);
  });
});
