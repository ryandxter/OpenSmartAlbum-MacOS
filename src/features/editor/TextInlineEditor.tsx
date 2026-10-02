import React, { useEffect, useLayoutEffect, useRef, useState, useMemo, useCallback } from 'react';
import Konva from 'konva';
import {
  TextNodeElement,
  DEFAULT_TEXT_STYLE,
  TextStyle,
  StyledRange,
  applyStyleToRange,
  applyHighlightToRange,
  updateRangesForTextChange,
  getTextRuns,
  resolveCssFontFamily,
  getActiveSelectionFormat,
  ActiveSelectionFormat,
} from '../../domain/text';
import { Unit, convertPtToUnit, convertUnitToPt } from '../../domain/units';
import { TextFormatToolbar } from './TextFormatToolbar';

export interface TextInlineEditorProps {
  element: TextNodeElement;
  stageRef: React.RefObject<Konva.Stage | null>;
  scaleFactor: number;
  canvasUnit?: Unit;
  dpi?: number;
  onCommit: (text: string, ranges?: StyledRange[], stylePatch?: Partial<TextStyle>) => void;
  onCancel: () => void;
}

type Draft = { text: string; ranges: StyledRange[] };
type SelectionOffsets = { start: number; end: number };

function getSelectionOffsets(root: HTMLElement): SelectionOffsets | null {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return null;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
  const before = document.createRange();
  before.selectNodeContents(root);
  before.setEnd(range.startContainer, range.startOffset);
  return { start: before.toString().length, end: before.toString().length + range.toString().length };
}

function restoreSelection(root: HTMLElement, offsets: SelectionOffsets) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  const locate = (offset: number): [Node, number] => {
    for (const node of nodes) {
      if (offset <= node.length) return [node, offset];
      offset -= node.length;
    }
    const last = nodes[nodes.length - 1];
    return last ? [last, last.length] : [root, 0];
  };
  const range = document.createRange();
  range.setStart(...locate(offsets.start));
  range.setEnd(...locate(offsets.end));
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

export function TextInlineEditor({
  element,
  stageRef,
  scaleFactor,
  canvasUnit = 'mm',
  dpi = 300,
  onCommit,
  onCancel,
}: TextInlineEditorProps) {
  const [draft, setDraft] = useState<Draft>({
    text: element.text || '',
    ranges: element.styledRanges || [],
  });
  const draftRef = useRef(draft);

  const [currentStyle, setCurrentStyle] = useState<TextStyle>(() => ({
    ...DEFAULT_TEXT_STYLE,
    ...element.style,
  }));
  const styleRef = useRef(currentStyle);
  styleRef.current = currentStyle;

  const [selectionRange, setSelectionRange] = useState<SelectionOffsets>({
    start: 0,
    end: draft.text.length,
  });
  const selectionRef = useRef<SelectionOffsets>(selectionRange);
  const [isSamplingColor, setIsSamplingColor] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const done = useRef(false);
  const composing = useRef(false);
  const past = useRef<Draft[]>([]);
  const future = useRef<Draft[]>([]);

  const unit = canvasUnit;
  const internalScale = 4;
  const visualScale = (convertPtToUnit(1, unit, dpi) * scaleFactor) / internalScale;
  const width = convertUnitToPt(element.width, unit, dpi) * internalScale;
  const height = convertUnitToPt(element.height, unit, dpi) * internalScale;
  const node = stageRef.current?.findOne(`#${element.id}`);
  const pos = node?.getAbsolutePosition() || { x: element.x * scaleFactor, y: element.y * scaleFactor };
  const rotation = node?.getAbsoluteRotation() ?? element.rotation;

  // Live active selection format detection
  const activeFormat: ActiveSelectionFormat = useMemo(() => {
    return getActiveSelectionFormat(
      draft.text,
      currentStyle,
      draft.ranges,
      selectionRange
    );
  }, [draft.text, currentStyle, draft.ranges, selectionRange]);

  const updateDraft = useCallback((next: Draft, selection?: SelectionOffsets) => {
    if (JSON.stringify(next) !== JSON.stringify(draftRef.current)) {
      past.current.push(draftRef.current);
      if (past.current.length > 100) past.current.shift();
      future.current = [];
    }
    draftRef.current = next;
    if (selection) {
      selectionRef.current = selection;
      setSelectionRange(selection);
    }
    setDraft(next);
  }, []);

  const syncSelection = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const offsets = getSelectionOffsets(root);
    if (offsets) {
      selectionRef.current = offsets;
      setSelectionRange(offsets);
    }
  }, []);

  useEffect(() => {
    const handleDocSelectionChange = () => {
      const root = rootRef.current;
      if (!root) return;
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return;
      if (root.contains(sel.anchorNode)) {
        syncSelection();
      }
    };
    document.addEventListener('selectionchange', handleDocSelectionChange);
    return () => document.removeEventListener('selectionchange', handleDocSelectionChange);
  }, [syncSelection]);

  const readInput = () => {
    const root = rootRef.current;
    if (!root || composing.current) return;
    const text = root.textContent || '';
    const selection = getSelectionOffsets(root) || { start: text.length, end: text.length };
    updateDraft(
      {
        text,
        ranges: updateRangesForTextChange(draftRef.current.ranges, draftRef.current.text, text),
      },
      selection
    );
  };

  const commit = useCallback(() => {
    if (done.current || composing.current) return;
    done.current = true;
    onCommit(draftRef.current.text, draftRef.current.ranges, styleRef.current);
  }, [onCommit]);

  const cancel = useCallback(() => {
    if (!done.current) {
      done.current = true;
      onCancel();
    }
  }, [onCancel]);

  // Own the editable DOM explicitly. Never parse or inject user-supplied HTML.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || composing.current) return;
    const fragment = document.createDocumentFragment();
    const runs = getTextRuns(draft.text, currentStyle, draft.ranges);
    // Legacy markup remains editable as source until it is explicitly converted.
    const displayRuns =
      runs.map((run) => run.text).join('') === draft.text
        ? runs
        : [{ ...currentStyle, text: draft.text }];
    for (const run of displayRuns) {
      const span = document.createElement('span');
      span.textContent = run.text;
      Object.assign(span.style, {
        fontFamily: resolveCssFontFamily(run.fontFamily || currentStyle.fontFamily),
        fontSize: `${(run.fontSize || currentStyle.fontSize) * internalScale}px`,
        fontWeight: run.fontWeight || currentStyle.fontWeight,
        fontStyle: run.fontStyle || currentStyle.fontStyle,
        textDecoration: run.textDecoration || currentStyle.textDecoration,
        color: run.fill || currentStyle.fill,
        backgroundColor: run.highlight || 'transparent',
      });
      fragment.appendChild(span);
    }
    if (!fragment.childNodes.length) fragment.appendChild(document.createTextNode(''));
    root.replaceChildren(fragment);

    // Only restore DOM selection to contentEditable if contentEditable or its container is actively focused!
    // Zero-blur focus preservation: prevents focus stealing when typing in Hex input or font size input
    const isEditorActive =
      document.activeElement === root || root.contains(document.activeElement);
    if (isEditorActive) {
      restoreSelection(root, selectionRef.current);
    }
  }, [draft, currentStyle]);

  useEffect(() => {
    rootRef.current?.focus({ preventScroll: true });
    if (rootRef.current) restoreSelection(rootRef.current, selectionRef.current);
  }, []);

  const insertText = (text: string) => {
    const root = rootRef.current;
    if (!root) return;
    const selection = getSelectionOffsets(root) || selectionRef.current;
    const previous = draftRef.current;
    const nextText =
      previous.text.slice(0, selection.start) + text + previous.text.slice(selection.end);
    const cursor = selection.start + text.length;
    updateDraft(
      {
        text: nextText,
        ranges: updateRangesForTextChange(previous.ranges, previous.text, nextText),
      },
      { start: cursor, end: cursor }
    );
  };

  const applyRangeFormat = useCallback(
    (patch: Partial<Omit<StyledRange, 'id' | 'start' | 'end'>>) => {
      const root = rootRef.current;
      const selection = (root && getSelectionOffsets(root)) || selectionRef.current;
      const curDraft = draftRef.current;
      if (selection.start < selection.end) {
        // Active selection slice
        const nextRanges = applyStyleToRange(
          curDraft.ranges,
          selection.start,
          selection.end,
          patch
        );
        updateDraft({ ...curDraft, ranges: nextRanges }, selection);
      } else if (curDraft.text.length > 0) {
        // Collapsed cursor: apply formatting to whole text
        const nextRanges = applyStyleToRange(
          curDraft.ranges,
          0,
          curDraft.text.length,
          patch
        );
        updateDraft({ ...curDraft, ranges: nextRanges }, selection);
      }
    },
    [updateDraft]
  );

  const clearHighlight = useCallback(() => {
    const root = rootRef.current;
    const selection = (root && getSelectionOffsets(root)) || selectionRef.current;
    const curDraft = draftRef.current;
    if (selection.start < selection.end) {
      const nextRanges = applyHighlightToRange(
        curDraft.ranges,
        selection.start,
        selection.end,
        undefined
      );
      updateDraft({ ...curDraft, ranges: nextRanges }, selection);
    } else if (curDraft.text.length > 0) {
      const nextRanges = applyHighlightToRange(
        curDraft.ranges,
        0,
        curDraft.text.length,
        undefined
      );
      updateDraft({ ...curDraft, ranges: nextRanges }, selection);
    }
  }, [updateDraft]);

  const applyBaseStyle = useCallback((patch: Partial<TextStyle>) => {
    setCurrentStyle((prev) => ({ ...prev, ...patch }));
  }, []);

  // Toolbar placement & top-edge auto-flip collision avoidance (pos.y < 50)
  const isNearTop = pos.y < 50;
  const toolbarPlacementStyle: React.CSSProperties = isNearTop
    ? { position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 60 }
    : { position: 'absolute', bottom: 'calc(100% + 8px)', left: 0, zIndex: 60 };

  return (
    <div
      style={{ position: 'absolute', inset: 0, zIndex: 50 }}
      onPointerDown={(event) => {
        // Eyedropper canvas lock: backdrop clicks ignore commit while sampling color
        if (isSamplingColor) return;
        if (event.target === event.currentTarget) commit();
      }}
    >
      <div
        ref={containerRef}
        style={{
          position: 'absolute',
          left: pos.x,
          top: pos.y,
          width: element.width * scaleFactor,
          height: element.height * scaleFactor,
          transform: `rotate(${rotation}deg)`,
          transformOrigin: 'top left',
          outline: '1px solid var(--color-accent)',
          background: 'rgba(15,23,42,0.08)',
        }}
      >
        {/* Docked Text Format Toolbar */}
        <TextFormatToolbar
          activeFormat={activeFormat}
          onApplyRangeFormat={applyRangeFormat}
          onApplyBaseStyle={applyBaseStyle}
          onClearHighlight={clearHighlight}
          onStartSamplingColor={() => setIsSamplingColor(true)}
          onStopSamplingColor={() => setIsSamplingColor(false)}
          isSamplingColor={isSamplingColor}
          style={toolbarPlacementStyle}
        />

        <div
          style={{
            width,
            minHeight: height,
            height: currentStyle.autoSize === 'height' ? undefined : height,
            transform: `scale(${visualScale})`,
            transformOrigin: 'top left',
            boxSizing: 'border-box',
            padding: currentStyle.padding * internalScale,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'auto',
            justifyContent:
              currentStyle.verticalAlign === 'middle'
                ? 'safe center'
                : currentStyle.verticalAlign === 'bottom'
                ? 'safe flex-end'
                : 'flex-start',
          }}
        >
          <div
            ref={rootRef}
            role="textbox"
            aria-label="Edit album text"
            aria-multiline="true"
            contentEditable={!element.locked}
            suppressContentEditableWarning
            spellCheck={false}
            onInput={readInput}
            onKeyUp={syncSelection}
            onPointerUp={syncSelection}
            onSelect={syncSelection}
            onCompositionStart={() => {
              composing.current = true;
            }}
            onCompositionEnd={() => {
              composing.current = false;
              readInput();
            }}
            onBeforeInput={(event) => {
              const input = event.nativeEvent as InputEvent;
              if (
                !composing.current &&
                (input.inputType === 'insertParagraph' || input.inputType === 'insertLineBreak')
              ) {
                event.preventDefault();
                insertText('\n');
              }
            }}
            onPaste={(event) => {
              event.preventDefault();
              insertText(event.clipboardData.getData('text/plain').replace(/\r\n?/g, '\n'));
            }}
            onDrop={(event) => event.preventDefault()}
            onBlur={(event) => {
              // Prevent blur-commit if focus moved into toolbar or child controls
              const related = event.relatedTarget as Node | null;
              if (containerRef.current && related && containerRef.current.contains(related)) {
                return;
              }
              if (isSamplingColor) return;
              commit();
            }}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.nativeEvent.isComposing || composing.current) return;
              const mod = event.ctrlKey || event.metaKey;
              const key = event.key.toLowerCase();
              if (key === 'escape') {
                event.preventDefault();
                cancel();
              } else if (key === 'enter') {
                event.preventDefault();
                if (mod) commit();
                else insertText('\n');
              } else if (mod && ['b', 'i', 'u'].includes(key)) {
                event.preventDefault();
                applyRangeFormat(
                  key === 'b'
                    ? { fontWeight: activeFormat.isBold === true ? 'normal' : 'bold' }
                    : key === 'i'
                    ? { fontStyle: activeFormat.isItalic === true ? 'normal' : 'italic' }
                    : { textDecoration: activeFormat.isUnderline === true ? 'none' : 'underline' }
                );
              } else if (mod && (key === 'z' || key === 'y')) {
                event.preventDefault();
                const redo = key === 'y' || event.shiftKey;
                const source = redo ? future : past;
                const destination = redo ? past : future;
                const next = source.current.pop();
                if (next) {
                  destination.current.push(draftRef.current);
                  draftRef.current = next;
                  selectionRef.current = { start: next.text.length, end: next.text.length };
                  setSelectionRange(selectionRef.current);
                  setDraft(next);
                }
              }
            }}
            style={{
              flexShrink: 0,
              minHeight: currentStyle.fontSize * currentStyle.lineHeight * internalScale,
              fontFamily: resolveCssFontFamily(currentStyle.fontFamily),
              fontSize: currentStyle.fontSize * internalScale,
              lineHeight: currentStyle.lineHeight,
              letterSpacing: currentStyle.letterSpacing * internalScale,
              textAlign: currentStyle.align,
              whiteSpace: currentStyle.wordWrap === 'none' ? 'pre' : 'pre-wrap',
              overflowWrap: 'anywhere',
              wordBreak: currentStyle.wordWrap === 'char' ? 'break-all' : 'normal',
              color: currentStyle.fill,
              outline: 'none',
              caretColor: 'var(--color-accent)',
            }}
          />
        </div>
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 5,
            whiteSpace: 'nowrap',
            fontSize: 10,
            color: '#cbd5e1',
            background: '#0f172a',
            padding: '3px 6px',
            pointerEvents: 'none',
          }}
        >
          Ctrl+Enter apply · Esc cancel
        </div>
      </div>
    </div>
  );
}
