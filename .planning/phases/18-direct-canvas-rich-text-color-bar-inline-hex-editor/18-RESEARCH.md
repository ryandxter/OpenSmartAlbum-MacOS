# Phase 18: Direct-Canvas Rich Text Color Bar & Inline Hex Editor — Research & Architecture

**Phase Goal:** Deliver a Figma-grade direct-canvas rich text editing experience with a docked formatting toolbar, editable `#RGB` / `#RRGGBB` Hex inputs, text background highlight controls (with 1-click transparent clear), mixed-color detection, selection preservation during color picking, and bidirectional sync with `TypographyPanel.tsx`.

---

## 1. Executive Summary & Current State Analysis

### 1.1 Existing Architecture Overview
The codebase currently has a rich text domain engine and inline editing infrastructure, but lacks an on-canvas docked formatting toolbar and inline hex color editor.

| Component / File | Current Role & Capabilities | Gaps for Phase 18 |
|---|---|---|
| `TextInlineEditor.tsx` | ContentEditable overlay rendered over Konva text nodes on double-click. Supports keyboard shortcuts (`Ctrl+B/I/U/Z/Y`), DOM span rendering for runs, and selection restoration. | Lacks on-canvas docked toolbar, color picker, hex inputs, highlight controls, and mixed-state detection. Blurs/commits immediately on click outside textarea. |
| `KonvaEditorCanvas.tsx` | Manages canvas layers, selection transformers, double-click triggers (`setEditingTextElementId`), and mounts `TextInlineEditor`. | Coordinates are physical units (`mm`/`pt`) scaled via `scaleFactor`. Text frame double-click is already wired. |
| `CarouselCanvas.tsx` | Social carousel canvas in pixel space (`1080x1080` etc.) with pan/zoom. | `CarouselTextFrame` exists in domain/store (`carouselStore.ts:addTextFrame`), but canvas currently only renders photo frames. |
| `TypographyPanel.tsx` | Inspector side panel with font family dropdown, size slider/input, formatting buttons (`B/I/U`), alignment, and color picker. | Quick format bar only formats `<textarea>` in the inspector; does not support background highlight pickers or direct canvas interaction. |
| `text.ts` & `styledRanges.ts` | Core domain models (`TextNodeElement`, `TextStyle`, `StyledRange`, `TextRun`). | `StyledRange` already has `fill` and `highlight` fields. `rangesToTextRuns` and `applyStyleToRange` provide character-range styling. |
| `richTextRenderer.ts` | Canvas 2D layout and rendering engine (`layoutRichText`, `drawRichTextLayout`). | Fully supports rendering `highlight` (rounded pill backgrounds) and `fill` (text color). |
| `ColorPicker.tsx` | Standalone UI component with saturation/value 2D box, hue slider, hex input, eyedropper (`sample_screen_color` Tauri command), and presets. | Needs adaptations for compact popover placement and non-blurring click behavior. |

---

## 2. Canvas Comparison: Print Album vs. Social Carousel

### 2.1 Coordinate Systems & Scale Factors

```
+-------------------------------------------------------------------------+
| PRINT ALBUM CANVAS (KonvaEditorCanvas.tsx)                              |
| - Coordinates: Physical Units ('mm', 'inch', 'pt')                     |
| - Conversion: pixelX = element.x * scaleFactor                         |
| - Layout Resolution: Base points (72 DPI) with visualScale             |
| - Internal Editor Scale: internalScale = 4 for high-DPI font sharpness |
+-------------------------------------------------------------------------+
                                    vs
+-------------------------------------------------------------------------+
| SOCIAL CAROUSEL CANVAS (CarouselCanvas.tsx)                             |
| - Coordinates: Pure Display Pixels (1080x1080, 1080x1350, 1080x1920)   |
| - Pan & Zoom: panOffset = {x, y}, zoomLevel (e.g. 0.25 to 3.0)         |
| - Slide Layout: Horizontal strip (slideIndex * slideWidthPx)            |
+-------------------------------------------------------------------------+
```

### 2.2 Text Data Models Comparison

```typescript
// Print Album Text Node (src/domain/text.ts)
export interface TextNodeElement {
  id: string;
  type: 'text';
  text: string;
  x: number; // in canvas units (mm/inch/pt)
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity?: number;
  locked?: boolean;
  style: TextStyle;
  styledRanges?: StyledRange[];
  textRuns?: TextRun[];
}

// Social Carousel Text Frame (src/domain/carousel.ts)
export interface CarouselTextFrame {
  type: 'text';
  id: string;
  x: number; // in screen pixels
  y: number;
  width: number;
  height: number;
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  color: string;
  align: 'left' | 'center' | 'right';
  locked: boolean;
  opacity?: number;
  rotation?: number;
}
```

### 2.3 Architectural Decision: Modular Formatting Toolbar
The direct-canvas rich text toolbar (`TextFormatToolbar.tsx`) should be designed as a standalone, modular component that operates on a standard interface:
- Current draft state (`text: string`, `ranges: StyledRange[]`, `baseStyle: TextStyle`).
- Active selection offsets (`{ start: number, end: number }`).
- Formatting callback: `onApplyFormat(patch: Partial<Omit<StyledRange, 'id' | 'start' | 'end'>>, isBaseStylePatch?: boolean)`.
- Base style callback: `onUpdateBaseStyle(patch: Partial<TextStyle>)`.

This ensures 100% code reuse between Print Album and Social Carousel.

---

## 3. Styled Ranges, Selection Offsets & Mixed Selection Handling

### 3.1 Styled Range Model
In `src/domain/styledRanges.ts`, `StyledRange` defines formatting overrides across 0-based character indexes:

```typescript
export interface StyledRange {
  id: string;
  start: number; // 0-based UTF-16 character index (inclusive)
  end: number;   // 0-based UTF-16 character index (exclusive)
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold' | '300' | '400' | '500' | '600' | '700' | '800';
  fontStyle?: 'normal' | 'italic';
  textDecoration?: 'none' | 'underline' | 'line-through';
  fill?: string;       // Text color (e.g. #FF0000)
  highlight?: string;  // Background highlight color (e.g. #FEF08A)
}
```

### 3.2 UTF-16 Character Selection Mapping
`TextInlineEditor.tsx` renders runs as `<span>` elements inside a contentEditable `div`. `getSelectionOffsets` maps the browser's DOM Range into clean UTF-16 character indices:

```typescript
function getSelectionOffsets(root: HTMLElement): SelectionOffsets | null {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return null;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
  const before = document.createRange();
  before.selectNodeContents(root);
  before.setEnd(range.startContainer, range.startOffset);
  return {
    start: before.toString().length,
    end: before.toString().length + range.toString().length,
  };
}
```

### 3.3 Active Formatting & Mixed Selection Detection
When text is selected (`start < end`), the toolbar must inspect all character slices within `[start, end]` to determine the active style:

```typescript
export interface ActiveSelectionFormat {
  isSelectionActive: boolean;
  isCollapsed: boolean; // caret only
  // Text Color
  fill: string | 'MIXED';
  isFillMixed: boolean;
  // Background Highlight
  highlight: string | 'MIXED' | 'NONE';
  isHighlightMixed: boolean;
  // Typography
  isBold: boolean | 'MIXED';
  isItalic: boolean | 'MIXED';
  isUnderline: boolean | 'MIXED';
  fontFamily: string | 'MIXED';
  fontSize: number | 'MIXED';
  align: 'left' | 'center' | 'right';
}
```

#### Extraction Algorithm:
1. Obtain non-overlapping `TextRun[]` for the text via `getTextRuns(text, baseStyle, ranges)`.
2. Find all runs that intersect `[start, end]`.
3. Slices overlapping the selection:
   - Collect set of `run.fill` colors.
   - Collect set of `run.highlight || 'NONE'` colors.
   - Collect set of `run.fontWeight`, `run.fontStyle`, `run.textDecoration`.
4. If `fills.size > 1` -> `isFillMixed: true`, `fill: 'MIXED'`.
5. If `highlights.size > 1` -> `isHighlightMixed: true`, `highlight: 'MIXED'`.
6. Visual Representation:
   - If `isFillMixed`, the Hex input shows placeholder `"Mixed"` (empty value) and the color swatch displays a multi-color/conic-gradient indicator.
   - If single color, the Hex input displays `#RRGGBB` and the swatch displays the solid color.

---

## 4. Precision Docked Toolbar Positioning

### 4.1 Coordinate Transforms & Anchoring

The toolbar must be anchored firmly to the **top boundary of the text box**:

```
                  +----------------------------------------------+
                  |  [B] [I] [U] | [ #FF0000 ] | [ #FEF08A ] ... |  <-- Docked Toolbar
                  +----------------------------------------------+
                                         | 8px gap
                  +----------------------------------------------+
                  | Text Box ContentEditable Area                |
                  | "Our Wedding Day in Bali"                    |
                  +----------------------------------------------+
```

### 4.2 Handling Zoom, Pan, Rotation, and Viewport Collision

1. **Relative Docking:**
   - The toolbar is rendered as a child of the text box container in `TextInlineEditor`:
     ```tsx
     <div style={{
       position: 'absolute',
       left: pos.x,
       top: pos.y,
       width: element.width * scaleFactor,
       height: element.height * scaleFactor,
       transform: `rotate(${rotation}deg)`,
       transformOrigin: 'top left',
     }}>
       {/* Docked Toolbar */}
       <TextFormatToolbar
         style={{
           position: 'absolute',
           bottom: 'calc(100% + 8px)',
           left: 0,
           zIndex: 60,
         }}
       />
       {/* Editable Area */}
       <div ... />
     </div>
     ```
   - **Advantage:** Inherits canvas pan and zoom scale factor automatically. It never drifts or shakes during canvas panning.

2. **Screen Boundary Flipping (Collision Avoidance):**
   - If `pos.y < 60px` (text box is near the top edge of the window), positioning above would push the toolbar off-screen.
   - **Auto-Flip:** Calculate bounding box in screen coordinates. If top margin is `< 50px`, dock toolbar **below** the text box (`top: calc(100% + 8px)`).
   - If `pos.x < 10px`, clamp left position so toolbar doesn't clip left screen boundary.

3. **Crisp 1:1 UI Scaling:**
   - The toolbar controls (buttons, hex inputs, text) should remain at standard 1:1 pixel scale (`fontSize: 12px`, `height: 34px`) rather than shrinking when the canvas is zoomed out to 25% or blowing up at 400%.
   - Toolbar uses fixed pixel layout, unaffected by `internalScale` (which only scales font rendering inside the editable content area).

---

## 5. Zero-Blur Selection Preservation Architecture

### 5.1 The Root Cause of Selection Loss
In standard HTML contentEditable elements:
- Clicking a button, swatch, or slider fires `mousedown`. The browser default is to shift focus away from the contentEditable `div`, triggering `blur`.
- `TextInlineEditor.tsx` currently has `onBlur={commit}`, which causes the editor to immediately commit and close upon clicking any external button.
- Clicking or typing in a `<input>` field requires real DOM focus, stealing focus from contentEditable.

### 5.2 Prevention Strategy

```
+-----------------------------------------------------------------------------+
| 1. Toolbar Buttons, Swatches, Presets, Sliders:                             |
|    - Attach `onMouseDown={(e) => e.preventDefault()}`                      |
|    - Attach `onPointerDown={(e) => e.stopPropagation()}`                   |
|    => Browser NEVER shifts focus; contentEditable selection stays active!   |
+-----------------------------------------------------------------------------+
| 2. Editable Hex Inputs & Popover Text Fields:                              |
|    - Save `selectionRef.current = { start, end }` before input focus.       |
|    - Guard container blur:                                                  |
|      `handleBlur = (e) => {`                                                |
|      `  if (containerRef.current?.contains(e.relatedTarget)) return;`       |
|      `  commit();`                                                          |
|      `}`                                                                    |
|    => Switching between contentEditable and Hex input does NOT commit/exit! |
+-----------------------------------------------------------------------------+
| 3. Live Formatting Application:                                            |
|    - Modifying color in Hex input applies format to `selectionRef.current`. |
|    - `useLayoutEffect` re-renders spans and calls `restoreSelection()`.    |
|    - Canvas preview updates live in real-time.                              |
+-----------------------------------------------------------------------------+
```

---

## 6. Hex Normalization & Color Engine

### 6.1 Supported Formats & Normalization Rules

| User Input | Valid? | Normalized Output | Applied CSS Color |
|---|---|---|---|
| `F00` | Yes (3-digit RGB) | `#FF0000` | `#FF0000` |
| `#f00` | Yes (3-digit RGB) | `#FF0000` | `#FF0000` |
| `0052B4` | Yes (6-digit RRGGBB) | `#0052B4` | `#0052B4` |
| `#1e293b` | Yes (6-digit RRGGBB) | `#1E293B` | `#1E293B` |
| `Mixed` | Placeholder / Read-only | `null` (No-op) | Keep existing run colors |
| `invalid` | Invalid | `null` (Buffered) | Retain previous valid color |

### 6.2 Normalization Utility Function

```typescript
export function normalizeHexColor(input: string): string | null {
  if (!input) return null;
  const clean = input.trim().replace(/^#/, '');
  if (/^[0-9A-Fa-f]{3}$/.test(clean)) {
    return '#' + clean.split('').map((c) => c + c).join('').toUpperCase();
  }
  if (/^[0-9A-Fa-f]{6}$/.test(clean)) {
    return '#' + clean.toUpperCase();
  }
  return null;
}
```

### 6.3 Debounce & Input Handling
- When typing into Hex input, validate on every `onChange`.
- If valid normalized hex is returned, apply live preview with ~100ms debounce.
- On `onBlur` or `onKeyDown (Enter)`, immediately commit the normalized hex.
- If input is left invalid on blur, revert display text to the last valid hex or `Mixed`.

---

## 7. Background Highlight & 1-Click Clear

### 7.1 Data Flow
- `StyledRange` supports `highlight?: string`.
- When a highlight color is selected (e.g. `#FEF08A`), `applyStyleToRange(draft.ranges, start, end, { highlight: '#FEF08A' })` sets the background color.
- When **Clear / Transparent** is clicked:
  - `applyStyleToRange(draft.ranges, start, end, { highlight: undefined })` deletes the `highlight` property from the range.
  - Slices revert cleanly to transparent background.

### 7.2 Highlight Presets Palette
- **Highlighters:** Yellow (`#FEF08A`), Green (`#BBF7D0`), Blue (`#BAE6FD`), Pink (`#FBCFE8`), Orange (`#FED7AA`), Lavender (`#E9D5FF`).
- **Neutrals / Dark:** Slate Dark (`#1E293B`), Neutral Gray (`#334155`), White Glow (`#FFFFFF`).
- **1-Click Clear Button:** With `Slash` / `Ban` icon or "Transparent" badge.

---

## 8. Bidirectional Sync & Single Undo History Transaction

### 8.1 Intra-Session vs. Global History
- **Intra-Session (Inside `TextInlineEditor`):**
  - Typing characters and applying formats updates local `past.current` and `future.current`.
  - Pressing `Ctrl+Z` / `Ctrl+Y` while editing undoes/redoes character edits and formatting within the active session.
- **Global History (Undo Stack in `historyStore.ts`):**
  - While editing is in progress, intermediate keystrokes do NOT flood `historyStore`.
  - When user finishes editing (clicks outside canvas, presses `Ctrl+Enter`), `onCommit` invokes `updateTextElement` without `skipHistory`, pushing **one single snapshot** of `currentAlbum` to `historyStore`.
  - Pressing `Ctrl+Z` in the main workspace undoes the entire text editing session in one clean step!

### 8.2 Inspector Bidirectional Synchronization
- `TypographyPanel.tsx` reads `element` from store.
- When inline editor commits, `TypographyPanel` immediately reflects updated text, font, and styled ranges.
- If user edits values in `TypographyPanel` (e.g. font size or alignment), changes are reflected on the canvas.

---

## 9. Design System & UI Specifications

### 9.1 Mac Dark Studio Visual Style
- **Toolbar Surface:** `#18181b` (Zinc-900)
- **Border:** `1px solid #27272a` (Zinc-800)
- **Box Shadow:** `0 8px 24px -4px rgba(0, 0, 0, 0.45), 0 2px 6px -1px rgba(0, 0, 0, 0.3)`
- **Border Radius:** `8px`
- **Height:** `34px` (compact, sleek)
- **Typography:** `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", sans-serif`
- **Active State Accent:** `#3b82f6` (Blue-500) or `#38bdf8` (Sky-400)
- **Icons:** Lucide React (`Bold`, `Italic`, `Underline`, `AlignLeft`, `AlignCenter`, `AlignRight`, `Type`, `Highlighter`, `Pipette`, `Ban`, `ChevronDown`)

### 9.2 Component Hierarchy & Layout

```
[ TextFormatToolbar ]
├── [ Format Group ]
│   ├── Button: Bold (B) [Active/Inactive/Mixed]
│   ├── Button: Italic (I) [Active/Inactive/Mixed]
│   └── Button: Underline (U) [Active/Inactive/Mixed]
├── [ Divider ]
├── [ Text Color Control ]
│   ├── Swatch Button (Solid / Gradient for Mixed)
│   ├── Hex Input (#RRGGBB / Mixed)
│   └── Popover Color Picker (Saturation Box + Hue Slider + Presets + Eyedropper)
├── [ Divider ]
├── [ Highlight Control ]
│   ├── Swatch Button (Solid / None / Gradient)
│   ├── Hex Input (#RRGGBB / Mixed)
│   ├── 1-Click Clear Button (Ban/Transparent)
│   └── Popover Highlight Picker (Highlighter Presets + Custom Color)
├── [ Divider ]
├── [ Font Size Stepper ]
│   ├── Stepper [-]
│   ├── Input (e.g. 24 pt)
│   └── Stepper [+]
└── [ Alignment Group ]
    ├── Button: Align Left
    ├── Button: Align Center
    └── Button: Align Right
```

---

## 10. Potential Edge Cases & Mitigations

| Edge Case | Risk | Mitigation |
|---|---|---|
| User clicks color swatch while text is selected | Selection is dropped due to DOM blur | Add `onMouseDown={(e) => e.preventDefault()}` on all swatch and popover buttons. |
| User types `#F00` in Hex input | Incomplete or 3-digit hex could be rejected or malformed | `normalizeHexColor` expands 3-digit RGB to 6-digit RRGGBB (`#FF0000`) before applying. |
| Selection spans multiple colors (`#FF0000` + `#00FF00`) | Displaying one color would be deceptive | Detect distinct colors in range; set `isFillMixed: true`, show placeholder `"Mixed"` and multi-color gradient swatch. |
| User applies color with collapsed cursor (no text selected) | Nothing changes or entire text changes unexpectedly | If selection is collapsed (`start === end`), apply color to base style `style.fill` or set active typing attribute for newly typed text. |
| Text box is at top of screen (`y < 50px`) | Docked toolbar renders off-screen | Collision detection flips toolbar below text box (`top: calc(100% + 8px)`). |
| Eyedropper sampling across canvas | CORS or canvas layer clipping issues | Use native `sample_screen_color` Tauri command with DOM canvas pixel reading fallback. |
| Undo/Redo during inline editing | Clashing with global album undo stack | Maintain local `past`/`future` stack inside `TextInlineEditor` for intra-session edits; push single transaction to `historyStore` on commit. |

---

## 11. Recommendations for Phase 18 Implementation Plan

1. **Create Shared Helpers:**
   - `src/domain/richTextSelection.ts`: Selection format extraction (`getActiveSelectionFormat`), mixed-color detection, and hex normalization (`normalizeHexColor`).
2. **Create Docked Toolbar Component:**
   - `src/features/editor/TextFormatToolbar.tsx`: Mac dark studio toolbar containing formatting toggles, color swatch, hex input, highlight controls with clear button, font size stepper, and alignment.
3. **Integrate into `TextInlineEditor.tsx`:**
   - Attach `TextFormatToolbar` docked above text box container.
   - Implement zero-blur `onMouseDown` and `onBlur` container guards.
   - Connect live selection format updating.
4. **Update `TypographyPanel.tsx`:**
   - Add text background highlight control with hex input and 1-click clear to the Inspector typography panel.
5. **Verify Comprehensive Test Suite:**
   - Unit tests for hex normalization, mixed selection detection, styled range slicing, and undo transaction consistency.
