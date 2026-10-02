import React, { useState, useRef, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Ban,
  Minus,
  Plus,
  Pipette,
} from 'lucide-react';
import { ActiveSelectionFormat, normalizeHexColor } from '../../domain/richTextSelection';
import { StyledRange } from '../../domain/styledRanges';
import { TextStyle } from '../../domain/text';
import styles from './TextFormatToolbar.module.css';

export interface TextFormatToolbarProps {
  activeFormat: ActiveSelectionFormat;
  onApplyRangeFormat: (patch: Partial<Omit<StyledRange, 'id' | 'start' | 'end'>>) => void;
  onApplyBaseStyle: (patch: Partial<TextStyle>) => void;
  onClearHighlight: () => void;
  onStartSamplingColor?: () => void;
  onStopSamplingColor?: () => void;
  isSamplingColor?: boolean;
  disabled?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

export const HIGHLIGHTER_PRESETS = [
  { label: 'Yellow', color: '#FEF08A' },
  { label: 'Green', color: '#BBF7D0' },
  { label: 'Blue', color: '#BAE6FD' },
  { label: 'Pink', color: '#FBCFE8' },
  { label: 'Orange', color: '#FED7AA' },
  { label: 'Lavender', color: '#E9D5FF' },
  { label: 'Slate Dark', color: '#334155' },
  { label: 'Neutral Gray', color: '#E2E8F0' },
  { label: 'White Glow', color: '#FFFFFF' },
];

export const TEXT_COLOR_PRESETS = [
  '#FFFFFF', '#F8FAFC', '#CBD5E1', '#94A3B8', '#475569', '#1E293B',
  '#0F172A', '#000000', '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'
];

function hexToHsv(hex: string): { h: number; s: number; v: number } {
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  const r = (parseInt(clean.slice(0, 2), 16) || 0) / 255;
  const g = (parseInt(clean.slice(2, 4), 16) || 0) / 255;
  const b = (parseInt(clean.slice(4, 6), 16) || 0) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (max !== min) {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return { h: h * 360, s: s * 100, v: v * 100 };
}

function hsvToHex(h: number, s: number, v: number): string {
  const sNorm = s / 100;
  const vNorm = v / 100;
  const c = vNorm * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = vNorm - c;

  let r = 0, g = 0, b = 0;
  if (h >= 0 && h < 60) { r = c; g = x; b = 0; }
  else if (h >= 60 && h < 120) { r = x; g = c; b = 0; }
  else if (h >= 120 && h < 180) { r = 0; g = c; b = x; }
  else if (h >= 180 && h < 240) { r = 0; g = x; b = c; }
  else if (h >= 240 && h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }

  const toHex = (n: number) => {
    const val = Math.round((n + m) * 255);
    return Math.max(0, Math.min(255, val)).toString(16).padStart(2, '0');
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (c: number) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

const EYEDROPPER_CURSOR_SVG = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath d='M3 21l3-1 9-9-2-2-9 9-1 3z M15 9l2-2 1 1-2 2z M17 7l1-1c1-1 2.5-1 3.5 0s1 2.5 0 3.5l-1 1z' fill='%23000000' stroke='%23000000' stroke-width='2' stroke-linejoin='round'/%3E%3Cpath d='M3 21l3-1 9-9-2-2-9 9-1 3z' fill='%23ffffff' stroke='%23000000' stroke-width='1.2'/%3E%3Cpath d='M15 9l2-2 1 1-2 2z' fill='%233b82f6' stroke='%23000000' stroke-width='1.2'/%3E%3Cpath d='M17 7l1-1c.8-.8 2-.8 2.8 0s.8 2 0 2.8l-1 1z' fill='%23ef4444' stroke='%23000000' stroke-width='1.2'/%3E%3Ccircle cx='2' cy='22' r='1.5' fill='%23ef4444' stroke='%23ffffff' stroke-width='0.5'/%3E%3C/svg%3E`;

export function TextFormatToolbar({
  activeFormat,
  onApplyRangeFormat,
  onApplyBaseStyle,
  onClearHighlight,
  onStartSamplingColor,
  onStopSamplingColor,
  isSamplingColor = false,
  disabled = false,
  style,
  className = '',
}: TextFormatToolbarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const colorPopoverRef = useRef<HTMLDivElement>(null);
  const highlightPopoverRef = useRef<HTMLDivElement>(null);
  const satBoxRef = useRef<HTMLDivElement>(null);
  const hueSliderRef = useRef<HTMLDivElement>(null);

  // Popover visibility
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [samplingTarget, setSamplingTarget] = useState<'fill' | 'highlight' | null>(null);

  const stopSampling = useCallback(() => {
    setSamplingTarget(null);
    onStopSamplingColor?.();
  }, [onStopSamplingColor]);

  // Font size local input state
  const isFontSizeMixed = activeFormat.fontSize === 'MIXED';
  const [fontSizeInput, setFontSizeInput] = useState(() =>
    isFontSizeMixed ? '' : String(activeFormat.fontSize)
  );

  useEffect(() => {
    setFontSizeInput(isFontSizeMixed ? '' : String(activeFormat.fontSize));
  }, [activeFormat.fontSize, isFontSizeMixed]);

  const commitFontSize = () => {
    if (fontSizeInput.trim() === '') {
      setFontSizeInput(isFontSizeMixed ? '' : String(activeFormat.fontSize));
      return;
    }
    const val = parseFloat(fontSizeInput);
    if (Number.isFinite(val) && val >= 1) {
      const clamped = Math.max(6, Math.min(200, Math.round(val)));
      onApplyRangeFormat({ fontSize: clamped });
      setFontSizeInput(String(clamped));
    } else {
      setFontSizeInput(isFontSizeMixed ? '' : String(activeFormat.fontSize));
    }
  };

  // Text Fill Color state
  const isFillMixed = activeFormat.isFillMixed || activeFormat.fill === 'MIXED';
  const currentFillHex = isFillMixed ? '' : (activeFormat.fill || '#1E293B').replace('#', '');
  const [fillHex, setFillHex] = useState(currentFillHex);
  const [fillHsv, setFillHsv] = useState(() =>
    hexToHsv(isFillMixed ? '#1E293B' : (activeFormat.fill || '#1E293B'))
  );

  useEffect(() => {
    const nextHex = isFillMixed ? '' : (activeFormat.fill || '#1E293B').replace('#', '');
    setFillHex(nextHex);
    if (!isFillMixed && activeFormat.fill) {
      setFillHsv(hexToHsv(activeFormat.fill));
    }
  }, [activeFormat.fill, isFillMixed]);

  // Text Highlight Color state
  const isHighlightMixed = activeFormat.isHighlightMixed || activeFormat.highlight === 'MIXED';
  const isHighlightNone =
    activeFormat.highlight === 'NONE' ||
    !activeFormat.highlight ||
    activeFormat.highlight === 'transparent' ||
    activeFormat.highlight === '';
  const currentHighlightHex =
    isHighlightMixed || isHighlightNone ? '' : activeFormat.highlight.replace('#', '');
  const [highlightHex, setHighlightHex] = useState(currentHighlightHex);
  const [highlightHsv, setHighlightHsv] = useState(() =>
    hexToHsv(isHighlightNone || isHighlightMixed ? '#FEF08A' : activeFormat.highlight)
  );

  useEffect(() => {
    const nextHex =
      isHighlightMixed || isHighlightNone ? '' : activeFormat.highlight.replace('#', '');
    setHighlightHex(nextHex);
    if (!isHighlightMixed && !isHighlightNone && activeFormat.highlight) {
      setHighlightHsv(hexToHsv(activeFormat.highlight));
    }
  }, [activeFormat.highlight, isHighlightMixed, isHighlightNone]);

  // Outside click to dismiss popovers
  useEffect(() => {
    if (!showColorPicker && !showHighlightPicker) return;
    const handleOutsideClick = (e: MouseEvent | PointerEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowColorPicker(false);
        setShowHighlightPicker(false);
      }
    };
    document.addEventListener('pointerdown', handleOutsideClick);
    return () => document.removeEventListener('pointerdown', handleOutsideClick);
  }, [showColorPicker, showHighlightPicker]);

  // Eyedropper activation
  const handleStartEyedropper = useCallback(
    (target: 'fill' | 'highlight', e?: React.MouseEvent) => {
      if (disabled) return;
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      setShowColorPicker(false);
      setShowHighlightPicker(false);
      setSamplingTarget(target);
      onStartSamplingColor?.();
    },
    [disabled, onStartSamplingColor]
  );

  // Screen / canvas sampling listener
  useEffect(() => {
    if (!samplingTarget) return;

    const styleEl = document.createElement('style');
    styleEl.id = 'eyedropper-global-cursor-override';
    styleEl.textContent = `
      *, *:hover, *:active, canvas, .konvajs-content, .konvajs-content * {
        cursor: url("${EYEDROPPER_CURSOR_SVG}") 2 22, crosshair !important;
      }
    `;
    document.head.appendChild(styleEl);

    const activationTime = Date.now();

    const handlePointerDown = async (e: MouseEvent | PointerEvent) => {
      if (Date.now() - activationTime < 100) return;
      e.preventDefault();
      e.stopPropagation();

      let pickedColor: string | null = null;

      try {
        const hex = await invoke<string>('sample_screen_color');
        if (hex && typeof hex === 'string' && hex.startsWith('#')) {
          pickedColor = hex.toUpperCase();
        }
      } catch (err) {
        console.warn('Native screen sampling fallback to DOM:', err);
      }

      if (!pickedColor) {
        const elements = document.elementsFromPoint(e.clientX, e.clientY);
        const canvases = elements.filter((el): el is HTMLCanvasElement => el.tagName === 'CANVAS');
        for (const canvas of canvases) {
          try {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const x = Math.floor((e.clientX - rect.left) * scaleX);
            const y = Math.floor((e.clientY - rect.top) * scaleY);
            if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
              const ctx =
                canvas.getContext('2d', { willReadFrequently: true }) || canvas.getContext('2d');
              if (ctx) {
                const pixel = ctx.getImageData(x, y, 1, 1).data;
                const alpha = pixel[3] ?? 0;
                if (alpha > 10) {
                  pickedColor = rgbToHex(pixel[0] ?? 0, pixel[1] ?? 0, pixel[2] ?? 0);
                  break;
                }
              }
            }
          } catch (err) {
            console.warn('Canvas pixel sampling warning:', err);
          }
        }
      }

      if (pickedColor) {
        if (samplingTarget === 'fill') {
          onApplyRangeFormat({ fill: pickedColor });
          setFillHex(pickedColor.replace('#', ''));
          setFillHsv(hexToHsv(pickedColor));
        } else if (samplingTarget === 'highlight') {
          onApplyRangeFormat({ highlight: pickedColor });
          setHighlightHex(pickedColor.replace('#', ''));
          setHighlightHsv(hexToHsv(pickedColor));
        }
      }

      stopSampling();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        stopSampling();
      }
    };

    window.addEventListener('pointerdown', handlePointerDown, { capture: true });
    window.addEventListener('keydown', handleKeyDown, { capture: true });

    return () => {
      const existing = document.getElementById('eyedropper-global-cursor-override');
      if (existing) existing.remove();
      window.removeEventListener('pointerdown', handlePointerDown, { capture: true });
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [samplingTarget, onApplyRangeFormat, stopSampling]);

  // Saturation / Value drag handler
  const handleSatBoxMouseDown = (
    e: React.MouseEvent<HTMLDivElement>,
    target: 'fill' | 'highlight'
  ) => {
    if (disabled || !satBoxRef.current) return;
    const rect = satBoxRef.current.getBoundingClientRect();
    const currentHsv = target === 'fill' ? fillHsv : highlightHsv;

    const updateFromPosition = (clientX: number, clientY: number) => {
      const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
      const y = Math.max(0, Math.min(rect.height, clientY - rect.top));
      const s = (x / rect.width) * 100;
      const v = (1 - y / rect.height) * 100;

      const newHsv = { ...currentHsv, s, v };
      const newHex = hsvToHex(newHsv.h, newHsv.s, newHsv.v);

      if (target === 'fill') {
        setFillHsv(newHsv);
        setFillHex(newHex.replace('#', ''));
        onApplyRangeFormat({ fill: newHex });
      } else {
        setHighlightHsv(newHsv);
        setHighlightHex(newHex.replace('#', ''));
        onApplyRangeFormat({ highlight: newHex });
      }
    };

    updateFromPosition(e.clientX, e.clientY);

    const onMouseMove = (moveEvent: MouseEvent) => {
      updateFromPosition(moveEvent.clientX, moveEvent.clientY);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Hue slider drag handler
  const handleHueSliderMouseDown = (
    e: React.MouseEvent<HTMLDivElement>,
    target: 'fill' | 'highlight'
  ) => {
    if (disabled || !hueSliderRef.current) return;
    const rect = hueSliderRef.current.getBoundingClientRect();
    const currentHsv = target === 'fill' ? fillHsv : highlightHsv;

    const updateFromPosition = (clientX: number) => {
      const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
      const h = (x / rect.width) * 360;

      const newHsv = { ...currentHsv, h };
      const newHex = hsvToHex(newHsv.h, newHsv.s, newHsv.v);

      if (target === 'fill') {
        setFillHsv(newHsv);
        setFillHex(newHex.replace('#', ''));
        onApplyRangeFormat({ fill: newHex });
      } else {
        setHighlightHsv(newHsv);
        setHighlightHex(newHex.replace('#', ''));
        onApplyRangeFormat({ highlight: newHex });
      }
    };

    updateFromPosition(e.clientX);

    const onMouseMove = (moveEvent: MouseEvent) => {
      updateFromPosition(moveEvent.clientX);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Fill Hex Commit
  const commitFillHex = (val: string) => {
    const normalized = normalizeHexColor(val, true);
    if (normalized) {
      setFillHex(normalized.replace('#', ''));
      setFillHsv(hexToHsv(normalized));
      onApplyRangeFormat({ fill: normalized });
    } else {
      setFillHex(isFillMixed ? '' : (activeFormat.fill || '#1E293B').replace('#', ''));
    }
  };

  // Highlight Hex Commit
  const commitHighlightHex = (val: string) => {
    if (val.trim() === '') {
      if (!isHighlightNone && !isHighlightMixed) {
        onClearHighlight();
        setHighlightHex('');
      }
      return;
    }
    const normalized = normalizeHexColor(val, true);
    if (normalized) {
      setHighlightHex(normalized.replace('#', ''));
      setHighlightHsv(hexToHsv(normalized));
      onApplyRangeFormat({ highlight: normalized });
    } else {
      setHighlightHex(
        isHighlightMixed || isHighlightNone ? '' : activeFormat.highlight.replace('#', '')
      );
    }
  };

  return (
    <div
      ref={containerRef}
      className={`${styles.toolbarContainer} ${disabled ? styles.disabled : ''} ${className}`}
      style={style}
      onMouseDown={(e) => {
        // Prevent clicking toolbar background from dropping focus/selection
        if ((e.target as HTMLElement).tagName !== 'INPUT') {
          e.preventDefault();
        }
      }}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).tagName !== 'INPUT') {
          e.stopPropagation();
        }
      }}
    >
      {/* 1. Bold, Italic, Underline Toggles */}
      <button
        type="button"
        aria-label="Bold"
        title="Bold (Ctrl+B)"
        disabled={disabled}
        className={`${styles.toolbarBtn} ${
          activeFormat.isBold === true
            ? styles.toolbarBtnActive
            : activeFormat.isBold === 'MIXED'
            ? styles.toolbarBtnMixed
            : ''
        }`}
        onMouseDown={(e) => e.preventDefault()}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() =>
          onApplyRangeFormat({
            fontWeight: activeFormat.isBold === true ? 'normal' : 'bold',
          })
        }
      >
        <span className={styles.btnTextBold}>B</span>
      </button>

      <button
        type="button"
        aria-label="Italic"
        title="Italic (Ctrl+I)"
        disabled={disabled}
        className={`${styles.toolbarBtn} ${
          activeFormat.isItalic === true
            ? styles.toolbarBtnActive
            : activeFormat.isItalic === 'MIXED'
            ? styles.toolbarBtnMixed
            : ''
        }`}
        onMouseDown={(e) => e.preventDefault()}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() =>
          onApplyRangeFormat({
            fontStyle: activeFormat.isItalic === true ? 'normal' : 'italic',
          })
        }
      >
        <span className={styles.btnTextItalic}>I</span>
      </button>

      <button
        type="button"
        aria-label="Underline"
        title="Underline (Ctrl+U)"
        disabled={disabled}
        className={`${styles.toolbarBtn} ${
          activeFormat.isUnderline === true
            ? styles.toolbarBtnActive
            : activeFormat.isUnderline === 'MIXED'
            ? styles.toolbarBtnMixed
            : ''
        }`}
        onMouseDown={(e) => e.preventDefault()}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() =>
          onApplyRangeFormat({
            textDecoration: activeFormat.isUnderline === true ? 'none' : 'underline',
          })
        }
      >
        <span className={styles.btnTextUnderline}>U</span>
      </button>

      <div className={styles.divider} />

      {/* 2. Font Size Stepper & Input */}
      <div className={styles.stepperGroup}>
        <button
          type="button"
          aria-label="Decrease font size"
          title="Decrease font size"
          disabled={disabled}
          className={styles.stepperBtn}
          onMouseDown={(e) => e.preventDefault()}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => {
            const current =
              typeof activeFormat.fontSize === 'number' ? activeFormat.fontSize : 24;
            onApplyRangeFormat({ fontSize: Math.max(6, current - 2) });
          }}
        >
          <Minus size={12} strokeWidth={2.2} />
        </button>

        <div className={styles.fontSizeInputWrapper}>
          <input
            type="text"
            inputMode="numeric"
            aria-label="Font size"
            className={styles.fontSizeInput}
            value={fontSizeInput}
            placeholder={isFontSizeMixed ? 'Mixed' : '24'}
            disabled={disabled}
            onChange={(e) => setFontSizeInput(e.target.value)}
            onBlur={commitFontSize}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                commitFontSize();
                (e.target as HTMLInputElement).blur();
              }
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          />
          <span className={styles.unitSuffix}>pt</span>
        </div>

        <button
          type="button"
          aria-label="Increase font size"
          title="Increase font size"
          disabled={disabled}
          className={styles.stepperBtn}
          onMouseDown={(e) => e.preventDefault()}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => {
            const current =
              typeof activeFormat.fontSize === 'number' ? activeFormat.fontSize : 24;
            onApplyRangeFormat({ fontSize: Math.min(200, current + 2) });
          }}
        >
          <Plus size={12} strokeWidth={2.2} />
        </button>
      </div>

      <div className={styles.divider} />

      {/* 3. Text Alignment Toggles */}
      <button
        type="button"
        aria-label="Align left"
        title="Align Left"
        disabled={disabled}
        className={`${styles.toolbarBtn} ${
          activeFormat.align === 'left' ? styles.toolbarBtnActive : ''
        }`}
        onMouseDown={(e) => e.preventDefault()}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onApplyBaseStyle({ align: 'left' })}
      >
        <AlignLeft size={13} strokeWidth={1.8} />
      </button>

      <button
        type="button"
        aria-label="Align center"
        title="Align Center"
        disabled={disabled}
        className={`${styles.toolbarBtn} ${
          activeFormat.align === 'center' ? styles.toolbarBtnActive : ''
        }`}
        onMouseDown={(e) => e.preventDefault()}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onApplyBaseStyle({ align: 'center' })}
      >
        <AlignCenter size={13} strokeWidth={1.8} />
      </button>

      <button
        type="button"
        aria-label="Align right"
        title="Align Right"
        disabled={disabled}
        className={`${styles.toolbarBtn} ${
          activeFormat.align === 'right' ? styles.toolbarBtnActive : ''
        }`}
        onMouseDown={(e) => e.preventDefault()}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onApplyBaseStyle({ align: 'right' })}
      >
        <AlignRight size={13} strokeWidth={1.8} />
      </button>

      <button
        type="button"
        aria-label="Align justify"
        title="Align Justify"
        disabled={disabled}
        className={`${styles.toolbarBtn} ${
          (activeFormat.align as string) === 'justify' ? styles.toolbarBtnActive : ''
        }`}
        onMouseDown={(e) => e.preventDefault()}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onApplyBaseStyle({ align: 'justify' as any })}
      >
        <AlignJustify size={13} strokeWidth={1.8} />
      </button>

      <div className={styles.divider} />

      {/* 4. Text Color Section */}
      <div className={styles.colorSection}>
        <button
          type="button"
          aria-label="Text color"
          title="Text Color"
          disabled={disabled}
          className={`${styles.swatchBtn} ${isFillMixed ? styles.swatchMixed : ''}`}
          style={{
            backgroundColor: isFillMixed ? undefined : activeFormat.fill || '#1E293B',
          }}
          onMouseDown={(e) => e.preventDefault()}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => {
            setShowColorPicker((prev) => !prev);
            setShowHighlightPicker(false);
          }}
        />

        <div className={styles.hexInputWrapper}>
          <span className={styles.hashPrefix}>#</span>
          <input
            type="text"
            aria-label="Text color hex"
            className={styles.hexInput}
            value={fillHex}
            placeholder={isFillMixed ? 'Mixed' : '000000'}
            disabled={disabled}
            maxLength={6}
            onChange={(e) => {
              const val = e.target.value;
              setFillHex(val);
              const clean = val.trim().replace('#', '');
              if (clean.length === 6 && /^[0-9A-Fa-f]{6}$/.test(clean)) {
                const hex = `#${clean.toUpperCase()}`;
                setFillHsv(hexToHsv(hex));
                onApplyRangeFormat({ fill: hex });
              }
            }}
            onBlur={() => commitFillHex(fillHex)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                commitFillHex(fillHex);
                (e.target as HTMLInputElement).blur();
              }
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          />
        </div>

        {/* Text Color Popover */}
        {showColorPicker && (
          <div
            ref={colorPopoverRef}
            className={styles.popover}
            onMouseDown={(e) => e.preventDefault()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className={styles.popoverHeader}>
              <span>Text Color</span>
            </div>

            {/* 2D Saturation / Value Box */}
            <div
              ref={satBoxRef}
              className={styles.saturationBox}
              style={{
                background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${fillHsv.h}, 100%, 50%))`,
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSatBoxMouseDown(e, 'fill');
              }}
            >
              <div
                className={styles.saturationThumb}
                style={{
                  left: `${fillHsv.s}%`,
                  top: `${100 - fillHsv.v}%`,
                  backgroundColor: isFillMixed ? '#1E293B' : activeFormat.fill || '#1E293B',
                }}
              />
            </div>

            {/* Hue Slider */}
            <div
              ref={hueSliderRef}
              className={styles.hueSlider}
              onMouseDown={(e) => {
                e.preventDefault();
                handleHueSliderMouseDown(e, 'fill');
              }}
            >
              <div
                className={styles.hueThumb}
                style={{
                  left: `${(fillHsv.h / 360) * 100}%`,
                }}
              />
            </div>

            {/* Eyedropper & Presets */}
            <div className={styles.popoverBottomRow}>
              <button
                type="button"
                title="Sample screen color"
                aria-label="Sample text color"
                className={`${styles.eyedropperBtn} ${
                  samplingTarget === 'fill' || isSamplingColor ? styles.eyedropperActive : ''
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => handleStartEyedropper('fill', e)}
              >
                <Pipette size={13} strokeWidth={1.8} />
              </button>
            </div>

            {/* Text Color Presets */}
            <div className={styles.presetGrid}>
              {TEXT_COLOR_PRESETS.map((color) => (
                <button
                  key={color}
                  type="button"
                  title={color}
                  className={`${styles.presetSwatch} ${
                    !isFillMixed && activeFormat.fill?.toUpperCase() === color.toUpperCase()
                      ? styles.presetActive
                      : ''
                  }`}
                  style={{ backgroundColor: color }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setFillHex(color.replace('#', ''));
                    setFillHsv(hexToHsv(color));
                    onApplyRangeFormat({ fill: color });
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className={styles.divider} />

      {/* 5. Text Background Highlight Section */}
      <div className={styles.colorSection}>
        <button
          type="button"
          aria-label="Text highlight color"
          title="Highlight Color"
          disabled={disabled}
          className={`${styles.swatchBtn} ${
            isHighlightMixed
              ? styles.swatchMixed
              : isHighlightNone
              ? styles.swatchTransparent
              : ''
          }`}
          style={{
            backgroundColor:
              isHighlightMixed || isHighlightNone ? undefined : activeFormat.highlight,
          }}
          onMouseDown={(e) => e.preventDefault()}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => {
            setShowHighlightPicker((prev) => !prev);
            setShowColorPicker(false);
          }}
        />

        <div className={styles.hexInputWrapper}>
          <span className={styles.hashPrefix}>#</span>
          <input
            type="text"
            aria-label="Highlight color hex"
            className={styles.hexInput}
            value={highlightHex}
            placeholder={isHighlightMixed ? 'Mixed' : 'None'}
            disabled={disabled}
            maxLength={6}
            onChange={(e) => {
              const val = e.target.value;
              setHighlightHex(val);
              const clean = val.trim().replace('#', '');
              if (clean.length === 6 && /^[0-9A-Fa-f]{6}$/.test(clean)) {
                const hex = `#${clean.toUpperCase()}`;
                setHighlightHsv(hexToHsv(hex));
                onApplyRangeFormat({ highlight: hex });
              }
            }}
            onBlur={() => commitHighlightHex(highlightHex)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                commitHighlightHex(highlightHex);
                (e.target as HTMLInputElement).blur();
              }
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          />
        </div>

        {/* 1-Click Clear Highlight Button */}
        <button
          type="button"
          aria-label="Clear highlight"
          title="Clear Highlight"
          disabled={disabled || isHighlightNone}
          className={styles.clearHighlightBtn}
          onMouseDown={(e) => e.preventDefault()}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => {
            onClearHighlight();
            setHighlightHex('');
          }}
        >
          <Ban size={13} strokeWidth={1.8} />
        </button>

        {/* Highlight Popover */}
        {showHighlightPicker && (
          <div
            ref={highlightPopoverRef}
            className={styles.popover}
            onMouseDown={(e) => e.preventDefault()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className={styles.popoverHeader}>
              <span>Highlight</span>
              {!isHighlightNone && (
                <button
                  type="button"
                  className={styles.popoverHeaderAction}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onClearHighlight();
                    setHighlightHex('');
                    setShowHighlightPicker(false);
                  }}
                >
                  <Ban size={10} strokeWidth={2} />
                  <span>Clear</span>
                </button>
              )}
            </div>

            {/* Highlighter Presets Palette */}
            <div className={styles.presetGrid9}>
              {HIGHLIGHTER_PRESETS.map((p) => (
                <button
                  key={p.color}
                  type="button"
                  title={`${p.label} (${p.color})`}
                  className={`${styles.presetSwatch} ${
                    !isHighlightMixed &&
                    !isHighlightNone &&
                    activeFormat.highlight?.toUpperCase() === p.color.toUpperCase()
                      ? styles.presetActive
                      : ''
                  }`}
                  style={{ backgroundColor: p.color }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setHighlightHex(p.color.replace('#', ''));
                    setHighlightHsv(hexToHsv(p.color));
                    onApplyRangeFormat({ highlight: p.color });
                  }}
                />
              ))}
            </div>

            {/* 2D Saturation / Value Box */}
            <div
              ref={satBoxRef}
              className={styles.saturationBox}
              style={{
                background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${highlightHsv.h}, 100%, 50%))`,
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSatBoxMouseDown(e, 'highlight');
              }}
            >
              <div
                className={styles.saturationThumb}
                style={{
                  left: `${highlightHsv.s}%`,
                  top: `${100 - highlightHsv.v}%`,
                  backgroundColor:
                    isHighlightNone || isHighlightMixed
                      ? '#FEF08A'
                      : activeFormat.highlight,
                }}
              />
            </div>

            {/* Hue Slider */}
            <div
              ref={hueSliderRef}
              className={styles.hueSlider}
              onMouseDown={(e) => {
                e.preventDefault();
                handleHueSliderMouseDown(e, 'highlight');
              }}
            >
              <div
                className={styles.hueThumb}
                style={{
                  left: `${(highlightHsv.h / 360) * 100}%`,
                }}
              />
            </div>

            {/* Eyedropper */}
            <div className={styles.popoverBottomRow}>
              <button
                type="button"
                title="Sample screen color for highlight"
                aria-label="Sample highlight color"
                className={`${styles.eyedropperBtn} ${
                  samplingTarget === 'highlight' || isSamplingColor ? styles.eyedropperActive : ''
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => handleStartEyedropper('highlight', e)}
              >
                <Pipette size={13} strokeWidth={1.8} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
