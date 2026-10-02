# Phase 18: Direct-Canvas Rich Text Color Bar & Inline Hex Editor — Critique & Architectural Debate

**Document Status:** Complete & Rigorous Evaluation  
**Reviewer Role:** `gsd-code-reviewer` (Debater & Parity Verifier)  
**Target Proposal:** `.planning/phases/18-direct-canvas-rich-text-color-bar-inline-hex-editor/18-RESEARCH.md`  
**Evaluation Scope:** Dual-Engine Parity (Print vs Carousel), Zero-Blur Selection Architecture, Hex Normalization State Machine, 60fps Scrub Performance, and Undo/Redo Transaction Isolation.

---

## 1. Executive Summary & Verdict Scorecard

The research document (`18-RESEARCH.md`) establishes a solid Figma-grade vision for direct-canvas rich text editing with docked formatting controls. However, a deep architectural audit of the codebase reveals **5 critical gaps, subtle edge-case traps, and dual-engine disparities** that must be addressed prior to execution.

### Evaluation Scorecard

| Evaluation Area | Rating | Key Finding / Critical Risk |
|---|---|---|
| **1. Dual-Engine 1:1 Parity** | ⚠️ **Significant Gap** | `CarouselTextFrame` in `carousel.ts` lacks `styledRanges`, `highlight`, and `style` objects. `CarouselCanvas.tsx` does not render text nodes or mount `TextInlineEditor`. |
| **2. Selection Preservation** | ⚠️ **Defect Risk** | Blindly calling `restoreSelection()` inside `useLayoutEffect` while the user is typing in the Hex `<input>` will steal focus back to contentEditable, breaking keyboard input. |
| **3. Hex Normalization** | ⚠️ **UX Glitch** | Live 3-digit normalization on keystroke 3 (`#1E2` → `#11EE22`) creates jarring color flash when typing a 6-digit hex (`#1E293B`). |
| **4. Rapid Scrub Performance** | ⚠️ **Frame Drop Risk** | Re-creating all DOM spans via `replaceChildren` and walking the DOM tree on every 60fps HSV saturation drag causes jank and CPU spikes. |
| **5. Undo/Redo Transactions** |  **Solid with 1 Edge Case** | Intra-session stack isolation is sound, but global top-bar Undo button clicks during active editing must be trapped/handled safely. |

---

## 2. Topic-by-Topic Critical Analysis

---

### Topic 1: Print Album Canvas vs. Carousel Canvas Dual-Engine 1:1 Parity & Modularity

#### Analysis & Findings:
1. **Domain Model Disparity:**
   - In Print Album (`src/domain/text.ts`): Text elements use [`TextNodeElement`](file:///Users/chiio/VSCode/albumaker/src/domain/text.ts#L49-L64) with deep styling (`style: TextStyle`, `styledRanges: StyledRange[]`, `textRuns: TextRun[]`).
   - In Social Carousel (`src/domain/carousel.ts`): Text elements use [`CarouselTextFrame`](file:///Users/chiio/VSCode/albumaker/src/domain/carousel.ts#L83-L99) which is a flat model:
     ```typescript
     export interface CarouselTextFrame {
       type: 'text';
       id: string;
       x: number; y: number; width: number; height: number;
       text: string;
       fontSize: number;
       fontFamily: string;
       fontWeight: string;
       color: string; // <-- Flat single color only!
       align: 'left' | 'center' | 'right';
       locked: boolean;
     }
     ```
   - **The Conflict:** `CarouselTextFrame` has no concept of `styledRanges`, `highlight` background color, `lineHeight`, `letterSpacing`, or character-level formatting.
2. **Rendering & Canvas Mount Gap:**
   - In [`CarouselCanvas.tsx`](file:///Users/chiio/VSCode/albumaker/src/features/carousel/CarouselCanvas.tsx#L641), the layer only filters `el.type === 'photo'`. Carousel Canvas currently does not render text nodes or mount [`TextInlineEditor`](file:///Users/chiio/VSCode/albumaker/src/features/editor/TextInlineEditor.tsx).
3. **Coordinate Systems & Scaling Differences:**
   - **Print Album Canvas (`KonvaEditorCanvas`):** Coordinates in physical units (`mm`/`pt`), scaled by `scaleFactor`. Text frame uses `internalScale = 4` for crisp font rasterization.
   - **Social Carousel Canvas (`CarouselCanvas`):** Coordinates in continuous pixel space (`1080x1080`), where `x` spans horizontal slides (`slideIndex * slideWidthPx`), with stage zoom `scale = zoomLevel / 100` and stage panning `stagePos = {x, y}`.

#### Verdict & Actionable Fixes:
> [!IMPORTANT]
> **Modularity Strategy:**
> 1. Decouple [`TextFormatToolbar`](file:///Users/chiio/VSCode/albumaker/src/features/editor/TextFormatToolbar.tsx) completely from canvas element types. It must operate purely on a standard interface:
>    ```typescript
>    interface TextFormatToolbarProps {
>      activeFormat: ActiveSelectionFormat;
>      onApplyRangeFormat: (patch: Partial<Omit<StyledRange, 'id' | 'start' | 'end'>>) => void;
>      onApplyBaseStyle: (patch: Partial<TextStyle>) => void;
>      onClearHighlight: () => void;
>      disabled?: boolean;
>    }
>    ```
> 2. Upgrade [`CarouselTextFrame`](file:///Users/chiio/VSCode/albumaker/src/domain/carousel.ts) to support `styledRanges?: StyledRange[]` and `style?: TextStyle` (or alias it cleanly to `TextNodeElement`) so that Rich Text formatting and background highlights work identically in both engines without data loss during SQLite persistence.

---

### Topic 2: Selection Preservation Edge Cases (Color Popover & Hex Typing)

#### Analysis & Findings:
1. **The Focus-Stealing Trap with `restoreSelection`:**
   - In `TextInlineEditor.tsx` (lines 95-119), `useLayoutEffect` runs whenever `draft` changes. It replaces DOM spans and unconditionally invokes `restoreSelection(root, selectionRef.current)`.
   - `restoreSelection` calls `selection.removeAllRanges()` and `selection.addRange(range)`.
   - When the user clicks into the Hex `<input>` in `TextFormatToolbar` and types a character (e.g. `A`), the Hex input triggers `onApplyRangeFormat`, updating `draft.ranges`.
   - This triggers `useLayoutEffect`, which calls `restoreSelection()`.
   - **Bug:** Setting the DOM selection back onto the `contentEditable` div **immediately yanks focus away from the `<input>`**, interrupting typing after a single character!
2. **Interactive Popover Scrubbing & Canvas Text Selection:**
   - When dragging inside the HSV Saturation box or Hue slider in [`ColorPicker.tsx`](file:///Users/chiio/VSCode/albumaker/src/components/ui/ColorPicker.tsx#L141-L202), `mousemove` events fire on `window`.
   - If the user's cursor wanders over other canvas elements, the browser may initiate native DOM text selection or drag behavior unless `user-select: none` is applied globally during drag.
3. **Eyedropper Overlay Collision:**
   - When Eyedropper mode is active (`isSampling: true`), the user clicks anywhere on the canvas to sample a pixel.
   - `TextInlineEditor.tsx` (line 141) has an outer backdrop with `onPointerDown={(e) => { if (e.target === e.currentTarget) commit(); }}`.
   - **Bug:** Clicking the canvas backdrop to sample a pixel with the eyedropper will trigger `commit()` and close the inline editor before the eyedropper command can deliver its sampled hex!

#### Verdict & Actionable Fixes:
> [!IMPORTANT]
> **Selection Preservation Guard Rules:**
> 1. **Focus Check in `restoreSelection`:**
>    ```typescript
>    const isEditorActive = document.activeElement === rootRef.current || rootRef.current?.contains(document.activeElement);
>    if (isEditorActive) {
>      restoreSelection(root, selectionRef.current);
>    }
>    ```
>    When the user is typing in Hex `<input>`, DOM selection inside `contentEditable` is visually maintained via CSS highlight or simulated selection, without stealing DOM focus.
> 2. **Eyedropper Backdrop Lock:**
>    If `isSamplingColor` is true, suppress the backdrop click-to-commit listener until sampling completes or is cancelled via Escape.
> 3. **Non-Blurring Toolbar Buttons:**
>    All buttons, swatches, stepper controls, and preset pills in `TextFormatToolbar` must specify `onMouseDown={(e) => e.preventDefault()}`.

---

### Topic 3: Live vs. On-Commit Hex Normalization (`#RGB` vs `#RRGGBB`)

#### Analysis & Findings:
1. **The 3-Digit Keystroke Jump Glitch:**
   - If `#RGB` (3-digit) is expanded live on every keystroke:
     - User wants to type `#1E293B` starting from an empty input.
     - Keystroke 1: `1` → invalid.
     - Keystroke 2: `1E` → invalid.
     - Keystroke 3: `1E2` → **Valid 3-digit!** Live normalization immediately expands it to `#11EE22` (bright lime green) and applies it to the canvas.
     - Keystroke 4: `1E29` → invalid. Canvas stays bright lime green.
     - Keystroke 5: `1E293` → invalid.
     - Keystroke 6: `1E293B` → **Valid 6-digit!** Canvas jumps to `#1E293B` (slate dark).
   - This creates an unpleasant and disorienting visual flash on the 3rd keystroke.
2. **Mixed Selection Handling:**
   - When text selection spans multiple colors (e.g. bold word is red, rest is black), `isFillMixed === true`.
   - The Hex input shows placeholder `"Mixed"`.
   - If the user clicks into the Hex input, the input value must be blank (`""`) so the user can immediately type a replacement color without manually deleting the word "Mixed".
   - If user blurs without typing, it reverts to `"Mixed"`.

#### Normalization State Machine Contract:

```
[ User Keystroke in Hex Input ]
              │
              ├── Length < 6 ────────► Buffer local string (Do NOT expand 3-digit live!)
              │                        Swatch shows last valid color or mixed indicator.
              │
              ├── Length === 6 / 7 ───► Validate /^[0-9A-Fa-f]{6}$/
              │                        If valid: Live preview on canvas (debounced 50ms)
              │
              └── On Blur / Enter ────► If 3-digit (/^[0-9A-Fa-f]{3}$/): Expand to #RRGGBB & commit
                                       If 6-digit (/^[0-9A-Fa-f]{6}$/): Normalize & commit
                                       If invalid: Revert to previous valid color or "Mixed"
```

#### Verdict & Actionable Fixes:
> [!TIP]
> Keep 3-digit `#RGB` expansion **deferred until `onBlur` or `Enter`**, while allowing 6-digit `#RRGGBB` to preview **live** as soon as the 6th character is typed. This completely eliminates the 3rd-character lime flash.

---

### Topic 4: Performance on Rapid Typing & Color Scrub

#### Analysis & Findings:
1. **DOM Tree Rebuilding Bottleneck:**
   - `TextInlineEditor.tsx` currently calls `root.replaceChildren(fragment)` and traverses the tree with `document.createTreeWalker` on every single state update.
   - During continuous HSV color scrubbing (dragging the 2D saturation/brightness box or hue slider), `onChange` fires 60–120 times per second.
   - Running full DOM destruction, recreation, and TreeWalker selection restoration at 120Hz creates severe UI jank, GC pressure, and frame drops.
2. **Range Slicing & Fragmentation:**
   - If a user scrubs color across characters `[5, 10]`, repeatedly calling [`applyStyleToRange`](file:///Users/chiio/VSCode/albumaker/src/domain/styledRanges.ts) without consolidation can fragment ranges into redundant adjacent slices (e.g. `[5,7]`, `[7,8]`, `[8,10]` all with the same `#3B82F6`).
   - Slices must be normalized and merged: adjacent ranges with identical properties must be coalesced into single contiguous ranges.

#### Verdict & Actionable Fixes:
> [!IMPORTANT]
> 1. **Direct DOM Mutation during Scrub:** While actively dragging the color picker slider/box, update the CSS `color` or `backgroundColor` property directly on the selected `<span>` elements or throttle the React state update with `requestAnimationFrame`.
> 2. **Range Normalization:** Ensure `applyStyleToRange` runs `normalizeStyledRanges()` to merge adjacent identical slices and prune empty/collapsed ranges (`start >= end`).

---

### Topic 5: Undo/Redo Transactions & Global History Isolation

#### Analysis & Findings:
1. **Intra-Session Isolation:**
   - Keystrokes, formatting clicks, and color adjustments made inside `TextInlineEditor` are pushed to local `past.current` and `future.current` refs.
   - `Ctrl+Z` / `Ctrl+Y` while editing correctly steps through intra-session character and format history.
   - Intermediate keystrokes do NOT call `historyStore.pushState()`, preventing the global undo stack from being flooded with hundreds of single-character snapshots.
2. **Single Global Commit Transaction:**
   - When editing commits (clicking outside or pressing `Ctrl+Enter`), `onCommit` calls [`updateTextElement`](file:///Users/chiio/VSCode/albumaker/src/stores/editorStore.ts#L562-L600) with `skipHistory = false`.
   - `updateTextElement` checks `if (JSON.stringify(original) === JSON.stringify(next)) return;`.
   - If changes occurred, it pushes **one single snapshot** of the pre-edit album to `historyStore`, and applies the updated element.
   - Pressing `Ctrl+Z` on the main canvas undoes the entire text editing session in one clean step.
3. **Edge Case: Top-Bar Undo Button Click During Active Editing:**
   - If the user leaves the text editor active and clicks the **Undo** button in the top application header, the top header dispatches `useHistoryStore.getState().undo()`.
   - Because `editingTextElementId` is still mounted, global undo would revert a previous canvas spread action underneath the open text editor.
   - **Mitigation:** The top header Undo/Redo buttons must check `if (editingTextElementId)`:
     - Either trigger the inline editor's intra-session undo, OR
     - Commit/cancel the inline editor first before executing global undo.

---

## 3. Required Architectural Plan Adjustments for Phase 18

Based on this debate and analysis, the following specifications must be codified into the Phase 18 implementation plan:

1. **Shared Domain Module (`src/domain/richTextSelection.ts`):**
   - `getActiveSelectionFormat(text, baseStyle, ranges, selection)`: Computes bold, italic, underline, font size, align, mixed fill, and mixed highlight.
   - `normalizeHexColor(input, allowThreeDigitExpand)`: Clean `#RGB` / `#RRGGBB` normalization with controlled 3-digit expansion.
   - `normalizeStyledRanges(ranges)`: Coalesces adjacent slices with identical styling to prevent range fragmentation.

2. **Standalone Docked Toolbar (`src/features/editor/TextFormatToolbar.tsx`):**
   - Pure, decoupled component with zero-blur `onMouseDown={(e) => e.preventDefault()}` on all interactive buttons/swatches.
   - Color picker popover with saturation box, hue slider, hex input, presets palette, and 1-click highlight clear button.
   - Safe Hex input handling: No focus stealing on live update, deferred 3-digit expansion, blank value on "Mixed" focus.

3. **Inline Editor Hardening (`src/features/editor/TextInlineEditor.tsx`):**
   - Anchor `TextFormatToolbar` securely to top of text box with auto-flip when `pos.y < 50px`.
   - Conditional `restoreSelection` to prevent focus disruption when typing in Hex input.
   - Eyedropper backdrop guard to prevent premature commit during canvas color sampling.

4. **Dual-Engine Text Parity Roadmap:**
   - Extend `CarouselTextFrame` in `src/domain/carousel.ts` and `carouselStore.ts` with `styledRanges?: StyledRange[]` and `style?: TextStyle` to guarantee 100% feature parity between Print Album and Social Carousel.

5. **Inspector Panel Alignment (`src/features/editor/TypographyPanel.tsx`):**
   - Add Text Background Highlight control with Hex input and 1-click Clear button in `TypographyPanel.tsx` to maintain 100% bidirectional parity between Direct-Canvas and Inspector panels.
