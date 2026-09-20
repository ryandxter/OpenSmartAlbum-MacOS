---
name: album-editor
description: >-
  Expert guide for the AFSNSmartAlbum album editor canvas, Konva rendering, 2D Topological
  Spatial Neighbor Graph multi-resize, smart magnetic snapping math, and crop interactions.
---

# Album Editor & Canvas Domain Skill

This skill contains the domain rules, mathematical models, and architectural specifications for the interactive album layout editor in AFSNSmartAlbum.

---

## 1. 2D Topological Spatial Neighbor Graph Multi-Resize

### The Problem with Linear Scaling
Applying a uniform affine transform $(x' = x_0 + (x - x_0) \cdot s)$ to a multi-frame selection shrinks or stretches inter-frame gaps proportionally to the distance from the origin.

### The Invariant
**When resizing multiple selected frames on the canvas, the physical gap distances between adjacent frames MUST remain 100% constant.**

### The Topological Algorithm (`src/domain/editor.ts` -> `calculateMultiFrameResize`)
1. **Overlap Projection**:
   - Two frames $A$ and $B$ are considered *horizontal neighbors* if $A$ is to the left of $B$ ($A.x < B.x$) AND their vertical projections overlap ($\max(A.y, B.y) < \min(A.y + A.h, B.y + B.h)$).
   - Similarly, $A$ and $B$ are *vertical neighbors* if $A$ is above $B$ ($A.y < B.y$) AND their horizontal projections overlap ($\max(A.x, B.x) < \min(A.x + A.w, B.x + B.w)$).
2. **Neighbor Identification**:
   - For each frame, find immediate `leftNeighbors` (the rightmost among those to its left with vertical overlap) and immediate `topNeighbors` (the bottommost among those above with horizontal overlap).
3. **Proportional Dimension Scaling**:
   - Scale each frame's pure width and height: $w_i' = w_i \cdot s$, $h_i' = h_i \cdot s$.
4. **Topological Chain Positioning**:
   - If frame $i$ has no left neighbor, it anchors at the left edge: $x_i' = \text{anchorX}$.
   - If frame $i$ has a left neighbor $L$, its position is derived strictly from $L$'s scaled right edge plus the preserved original gap:
     $$x_i' = L.x' + L.w' + (i.x - (L.x + L.w))$$
   - Same topological positioning applies along the vertical axis using top neighbor $T$:
     $$y_i' = T.y' + T.h' + (i.y - (T.y + T.h))$$
5. **Universal Layout Compatibility**:
   - Validated across single rows, single columns, 2x2 grids, and asymmetric 3-photo collages.

---

## 2. Smart Magnetic Snapping & Granular Targets

### Guidelines Calculation (`calculateSnapping`)
When dragging or multi-selecting frames:
1. Candidate snap lines are generated conditionally based on active `SnappingConfig`:
   - `snapToPageEdges`: Outer spread boundary edges (0, spreadWidth, 0, spreadHeight) and center gutter / spine crease lines.
   - `snapToPageCenters`: Facing page optical centerlines (left page center, right page center, spread center).
   - `snapToMargins`: Safe area cut allowance guides (`safeArea` offset from outer edges and spine).
   - `snapToFrames`: Neighboring frame collinear edges (`Align Left`, `Align Right`, `Align Top`, `Align Bottom`) and centerlines (`Align Center X`, `Align Center Y`).
   - `snapToEqualGaps`: Real-time equidistant gap snapping and dynamic distance guide HUD indicators.
2. Snap threshold is configurable (default: 2.0mm; presets: Soft 1.0mm, Standard 2.0mm, Strong 4.0mm).
3. Snapping can be configured in the dedicated **Settings** modal (`SettingsDialog.tsx`) and toggled via master switch or bypassed while moving canvas elements with <kbd>Ctrl</kbd> + drag. <kbd>Alt</kbd> + drag is reserved for duplicating canvas elements and does **not** bypass snapping.
4. Dimension matching (`"Match Width"`, `"Match Height"`) detects when a frame's width or height matches a nearby frame within $\pm 0.5\text{mm}$.
5. Distance dimension lines with cyan pill badges display the exact physical gap between aligned frames.

---

## 3. Dual Entity Frame Invariants

Frames hold two independent transformation entities:
1. **Outer Frame Geometry**: `(x, y, width, height, rotation)`.
2. **Inner Photo Crop**: `(cropX, cropY, cropScale)`.

### Actions:
- **`↺ Reset Ratio`** (`resetToOriginalRatio`): Adjusts frame dimensions $(w, h)$ to match the original image's aspect ratio (3:2, 4:3, 1:1, 16:9) centered at current position, leaving crop untouched.
- **`↺ Reset Crop`** (`resetCrop`): Resets internal `cropX = 0`, `cropY = 0`, `cropScale = 1.0` (center-fitted) without altering frame bounds.
- **Exit Crop Mode**: <kbd>Enter</kbd>, <kbd>Esc</kbd>, and a primary click/tap on empty canvas or pasteboard space exit crop mode. Clicking or dragging inside the active photo must keep crop mode active.

---

## 4. Canvas Photo Swap Interaction

- <kbd>Alt</kbd> + drag on a canvas element duplicates it; <kbd>Ctrl</kbd> + drag moves it without snapping; <kbd>Shift</kbd> + drag constrains movement to one axis.
- Do not overload those frame-body gestures for photo swapping.
- For a single selected, unlocked photo frame, a compact on-canvas `Swap Photos` drag handle (`⇄`) appears at the visual center of the photo. Dragging this handle moves photo content only; frame geometry remains stationary. The handle is hidden during crop mode, multi-selection, and while the frame body itself is being moved so it never appears detached from the live drag preview.
- A valid drop target must be a different, unlocked photo frame on the active spread. Text elements, locked frames, the source frame, and empty canvas space cancel without changing the document.
- The target displays a compact topmost `Release` badge that is independent of artwork z-index. A valid drop uses `swapFrames`, resets both crops consistently with the `S` shortcut, and creates one Undo step.
- The `S` shortcut is context-aware: exactly two selected photo frames reserve it for Swap; otherwise, when the Smart Layout HUD is active, it shuffles photo placement.

---

## 5. Shortcut Reference Accuracy

- The Settings shortcut reference must match implemented handlers and distinguish keyboard commands from canvas gestures.
- Every entry must state its active context, such as Canvas, Crop Mode, Filmstrip, Smart Layout, Text Editing, or Project.
- Keep unit-dependent actions generic: arrow-key nudge follows the project unit rather than always using millimeters.
- Whenever canvas interaction changes, update the shortcut catalog in `SettingsDialog.tsx` in the same change.

---

## 6. Group and Locked Selection Feedback

- The floating frame toolbar must expose Group/Ungroup as one toggle with one stable combined-shape icon, matching the Border toggle pattern. It remains neutral while grouping is inactive, turns cyan only when the current selection is one active group, and returns to neutral after ungrouping. The tooltip and accessible label change with the action, but the icon must not switch.
- A selected locked photo or text object displays a thin solid amber outline. The outline appears only after selection and never exposes resize or rotation handles while the selection remains fully locked.
- Persistent lock status is communicated by the compact padlock badge; do not keep an amber selection outline visible on unselected objects.
- Render selection feedback above the canvas perimeter border. Inset locked-object outlines by half their screen-space stroke width so the complete amber line remains visible when an object is flush with a canvas edge; keep selection strokes independent of zoom with `strokeScaleEnabled={false}`.
