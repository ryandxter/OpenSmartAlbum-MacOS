# Phase 19 Debate & Critique: Adaptive Layout Decorative Exclusion & Photo Swap Shortcut

**Role**: `gsd-code-reviewer` (Debater & Parity Verifier)  
**Target Document**: `.planning/phases/19-adaptive-layout-decorative-exclusion-photo-swap-shortcut/19-RESEARCH.md`  
**Date**: 2026-10-02  
**Status**: Rigorous Architecture Review & Parity Verification  

---

## Executive Critique & Summary

The architecture outlined in `19-RESEARCH.md` provides a solid mathematical foundation for 2D Spatial Subtraction (Maximal Empty Rectangles) and dual-engine photo swapping. However, rigorous scrutiny of the algorithms, canvas interaction loops, and state stores reveals **6 critical vulnerabilities, edge-case risks, and parity gaps** that must be resolved prior to implementation:

1. **Spatial Subtraction Spine/Gutter Clamping & Rotation AABB Gap**: Excluded obstacles that cross the spread spine or possess rotation angles will produce out-of-bounds slicing or geometric collisions unless pre-clamped and AABB-projected.
2. **Dangerous Fallback Invariant in `scoreAndSortVariations`**: If no non-colliding partition can be found, the layout engine currently falls back to colliding raw variations, clobbering stationary excluded frames.
3. **Sub-Pixel & Negative Partition Dimensions in Narrow Free Boxes**: Dividing small residual free boxes among multiple unlocked photos can yield negative frame dimensions.
4. **Z-Index Layer Inversion on Reassembly**: Simple concatenation of `[...locked, ...excluded, ...newUnlocked, ...text]` places decorative watermarks/logos *beneath* newly generated photo frames.
5. **Keyboard Shortcut `S` Input Leaks & Non-Photo Validation**: Lack of `isContentEditable` and `editingTextElementId` guards risks intercepting keystrokes during inline text editing, and selecting text nodes triggers false-positive swap toasts.
6. **`swapFrames` Locked-Element Parity Defect**: `carouselStore.ts` omits the `!frame.locked` guard present in `editorStore.ts`, allowing locked carousel frames to be mutated.

---

## 1. Evaluation: 2D Spatial Subtraction Across Spines, Gutters, and Multiple Pages

### 1.1 Spine-Spanning & Multi-Page Obstacle Slicing
In 2-page spreads, `computeRawLayoutPartitions` computes left and right page sub-boxes separately:
```ts
const freeLeftBoxes = computeFreePageSubBoxes(leftPageArea, locked, spacing);
const freeRightBoxes = computeFreePageSubBoxes(rightPageArea, locked, spacing);
```

#### Vulnerability Analysis:
- When an excluded frame $O$ spans across the center spine (e.g. starts on Left Page, crosses Gutter, ends on Right Page), $O$ intersects both `leftPageArea` and `rightPageArea`.
- In `computeFreePageSubBoxes(leftPageArea, locked, spacing)`:
  - $O.x + O.\text{width}$ is outside the left page boundary ($\text{box}.x + \text{box}.\text{width}$).
  - Slicing logic computes:
    $$\text{rightX} = O.x + O.\text{width} + \text{spacing}$$
    $$\text{rightW} = \text{box}.x + \text{box}.\text{width} - \text{rightX} < 0$$
  - While negative dimensions are filtered out by `minDimension`, obstacles that graze page edges by sub-pixel margins ($\le 0.5\text{px}$) can produce candidate boxes with zero area or floating-point imprecision.
- In `computeFreePageSubBoxes(rightPageArea, locked, spacing)`:
  - $O.x$ is inside the left page ($O.x < \text{box}.x$).
  - Slicing logic computes:
    $$\text{leftW} = O.x - \text{spacing} - \text{box}.x < 0$$ (discarded).
  - The Top and Bottom slices inherit the full $\text{box}.\text{width}$ of `rightPageArea`. If $O$ covers only a portion of the left side of `rightPageArea`, the Top slice extends across the whole right page, which is geometrically correct for Maximal Empty Rectangles.

#### Actionable Requirement:
- Before running 4-slice decomposition, compute the geometric intersection box $O_{\text{clamped}} = O \cap \text{pageArea}$. If $O_{\text{clamped}}$ is empty, skip the obstacle for that page box.

```ts
function getClampedIntersection(box: RectBounds, obstacle: RectBounds): RectBounds | null {
  const x1 = Math.max(box.x, obstacle.x);
  const y1 = Math.max(box.y, obstacle.y);
  const x2 = Math.min(box.x + box.width, obstacle.x + obstacle.width);
  const y2 = Math.min(box.y + box.height, obstacle.y + obstacle.height);
  if (x2 <= x1 || y2 <= y1) return null;
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}
```

---

### 1.2 Rotation Angle Handling (AABB Projection)
- `PhotoFrameElement` and `CarouselPhotoFrame` support `rotation?: number` (e.g., tilted stamps or angled polaroids).
- Current spatial subtraction and `rectsIntersect` use unrotated $(x, y, w, h)$.
- **Risk**: An excluded frame rotated $45^\circ$ will have visual corners extending far outside its unrotated bounding box. New auto-layout frames will be placed directly underneath these corners.
- **Actionable Requirement**: Project rotated obstacles to their Axis-Aligned Bounding Box (AABB) before subtracting:

```ts
export function getRotatedAABB(element: { x: number; y: number; width: number; height: number; rotation?: number }): RectBounds {
  const rot = (element.rotation || 0) * (Math.PI / 180);
  if (Math.abs(rot) < 0.001) {
    return { x: element.x, y: element.y, width: element.width, height: element.height };
  }
  const cos = Math.abs(Math.cos(rot));
  const sin = Math.abs(Math.sin(rot));
  const newW = element.width * cos + element.height * sin;
  const newH = element.width * sin + element.height * cos;
  const cx = element.x + element.width / 2;
  const cy = element.y + element.height / 2;
  return {
    x: round4(cx - newW / 2),
    y: round4(cy - newH / 2),
    width: round4(newW),
    height: round4(newH),
  };
}
```

---

### 1.3 Strict Invariant Enforcement in `scoreAndSortVariations`
- In `src/domain/adaptiveLayout.ts` (line 1033):
  ```ts
  const sourceVariations = nonColliding.length > 0 ? nonColliding : rawVariations;
  ```
- **Severe Defect**: Falling back to `rawVariations` when `nonColliding.length === 0` violates the exclusion invariant. If the available free space cannot accommodate the unlocked photos without collision, the engine must return `[]`, preventing layout corruption.
- **Fix**:
  ```ts
  const sourceVariations = nonColliding; // Strictly preserve obstacle boundaries
  ```

---

## 2. Evaluation: Edge Cases When All Frames Are Excluded or Locked

### 2.1 Zero-Unlocked Photo Handling
- If all photo frames on a spread or slide have `excludeFromAdaptiveLayout: true` or `locked: true`:
  - `unlockedElements.length === 0`.
  - `generateAdaptiveLayoutVariations` returns `[]`.
- **UX Defect**: `cycleSpreadLayout` and `cycleSlideLayout` currently return silently. When the user presses `Spacebar`, nothing happens, giving the impression that the keyboard or application is frozen.
- **Actionable Requirement**:
  ```ts
  if (unlockedElements.length === 0) {
    onToast?.('ℹ️ All photos on this spread are excluded or locked from layout cycling');
    return;
  }
  ```

---

### 2.2 Narrow Free Box & Sub-Pixel Division in `partitionPageBoxIntoKRects`
- When $K$ unlocked photos are distributed into a small free sub-box $B$:
  - If $B.\text{width} < K \times \text{minPhotoSize} + (K - 1) \times \text{spacing}$, partitioning formulas produce negative or sub-pixel widths (e.g. $\text{colW} = (B.\text{width} - 3 \times \text{spacing}) / 4 < 0$).
  - Negative dimensions cause Konva render panics and inverted hit-testing zones.
- **Actionable Requirement**:
  - In `computeRawLayoutPartitions`, before calling `partitionPageBoxIntoKRects(box, count, spacing, v)`, verify that `box.width >= count * minDimension && box.height >= minDimension` (or vice versa for stacked layouts).
  - In `partitionPageBoxIntoKRects`, add dimension sanity assertions clamping dimensions to $\ge 10\text{px}$.

---

### 2.3 Z-Index & Stacking Layer Inversion on Reassembly
- When assembling the new spread elements:
  ```ts
  const newElements = [...lockedElements, ...excludedElements, ...newUnlockedElements, ...textElements];
  ```
- **Flaw**: Concatenating `excludedElements` *before* `newUnlockedElements` assigns lower z-indices to excluded elements. If an excluded frame is a decorative watermark, logo, or stamp, newly created photo frames will render on top of it, obscuring it.
- **Actionable Requirement**:
  - Preserve the original relative `zIndex` of `excludedElements` and `lockedElements`.
  - Stably sort `newElements` by their original z-index or assign `newUnlockedElements` within the available z-index slots of the replaced frames.

---

## 3. Evaluation: Spacebar Shuffle & Photo Reassignment Preserving Excluded Photos

### 3.1 Content Shuffle Invariance (`shuffleElementsPhotos`)
- `shuffleElementsPhotos` in `src/domain/adaptiveLayout.ts` filters elements:
  ```ts
  if (!el.locked && !el.excludeFromAdaptiveLayout) {
    unlockedIndices.push(idx);
    unlockedPayloads.push({ ...photoPayload });
  }
  ```
- **Parity Verification**:
  - Excluded frames remain at `origIdx` with their original `filePath`, `previewPath`, `thumbnailPath`, and `photoAspect`.
  - If `unlockedPayloads.length <= 1`, shuffle safely no-ops.
  - Toast feedback must be provided: `if (unlockedPayloads.length <= 1) onToast?.('⚠️ Need at least 2 non-excluded photos to shuffle content')`.

### 3.2 Dual-Engine Parity in `carouselStore.ts`
- `carouselStore.ts` currently implements slide auto-flow but lacks dedicated `shuffleSlidePhotos`.
- **Actionable Requirement**: Implement `shuffleSlidePhotos(slideIndex: number)` in `carouselStore.ts` with identical `!el.locked && !el.excludeFromAdaptiveLayout` filtering to guarantee 1:1 functional parity with `albumStore.ts`.

---

## 4. Evaluation: Keyboard Shortcut `S` Handling & Dual-Engine Parity

### 4.1 Inline Text Editing & Input Leaks
In `KonvaEditorCanvas.tsx`:
- Line 1795 checks `tag === 'input' || tag === 'textarea' || tag === 'select'`.
- **Omission**: It fails to check `target.isContentEditable` and the canvas state `editingTextElementId !== null`.
- When a user double-clicks a text element to edit inline text, typing the letter `s` or `S` triggers the global canvas shortcut listener unless properly guarded.

In `CarouselCanvas.tsx`:
- Lines 506–512 check `target.isContentEditable`, but must also check `editingTextId !== null`.

#### Actionable Requirement:
```ts
// Universal text-input guard in both KonvaEditorCanvas and CarouselCanvas
const isEditingText = Boolean(
  target.tagName === 'INPUT' ||
  target.tagName === 'TEXTAREA' ||
  target.tagName === 'SELECT' ||
  target.isContentEditable ||
  target.closest('[contenteditable="true"]') ||
  editingTextElementId !== null // or editingTextId !== null in Carousel
);
if (isEditingText) return;
```

---

### 4.2 Non-Photo Frame Filtering & Contextual Feedback
- What happens if the user selects 2 elements where one or both are text nodes (e.g. 1 TextNode + 1 PhotoFrame, or 2 TextNodes) and presses `S`?
- In `19-RESEARCH.md`:
  `if (selectedFrameIds.length === 2) { swapFrames(...); onToast?.('✓ Swapped 2 photos'); }`
- **Flaw**: `swapFrames` in the store silently rejects non-photo frames, but the canvas handler displays a false-positive toast "✓ Swapped 2 photos".
- **Actionable Requirement**:
  Filter selection by element type before initiating swap:

```ts
const selectedPhotoElements = selectedElements.filter(
  (el): el is PhotoFrameElement => el.type === 'photo' && Boolean(el.photoId) && !el.locked
);

if (e.key.toLowerCase() === 's' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
  if (selectedFrameIds.length === 2) {
    e.preventDefault();
    if (selectedPhotoElements.length === 2) {
      swapFrames(activeSpread.id, selectedPhotoElements[0].id, selectedPhotoElements[1].id);
      onToast?.('✓ Swapped 2 photos');
    } else {
      onToast?.('⚠️ Select 2 unlocked photo frames to swap');
    }
  } else if (selectedFrameIds.length === 1) {
    e.preventDefault();
    if (selectedPhotoElements.length === 1) {
      setIsSwapHandleFocused(true);
      onToast?.('⇄ Photo swap handle active — drag to another photo to swap');
    } else {
      onToast?.('⚠️ Photo swap handle is only available on photo frames');
    }
  }
}
```

---

### 4.3 Carousel Canvas Swap Handle & Draggable Parity
- `KonvaEditorCanvas.tsx` features a dedicated draggable cyan swap handle (`photo-swap-handle`) at the center of a single selected photo frame.
- `CarouselCanvas.tsx` currently only supports whole-frame dragging.
- **Parity Requirement**:
  - Add the center draggable cyan swap handle group (`Circle` + `KonvaText` `⇄` in `#38bdf8`) to `CarouselCanvas.tsx`.
  - Add dragging hit-tests with `findPhotoSwapTarget` and drop execution via `useCarouselStore.getState().swapFrames(sourceId, targetId)`.
  - Add pulse animation state (`isSwapHandleFocused`) triggered on `S` keypress.

---

### 4.4 `swapFrames` Locked-Element Store Parity
- **Defect in `src/stores/carouselStore.ts` (line 1686)**:
  `carouselStore.ts` checks `if (!frameA || !frameB) return;` but **does not check** `frameA.locked || frameB.locked`.
- In `src/stores/editorStore.ts` (line 1156):
  `if (!elA || !elB || elA.locked || elB.locked) return elements;`
- **Parity Fix**: Update `carouselStore.ts` to enforce `if (!frameA || !frameB || frameA.locked || frameB.locked) return;`.

---

## 5. Summary Matrix of Required Fixes

| Area | Research Gap / Vulnerability | Required Resolution |
| :--- | :--- | :--- |
| **Spatial Subtraction** | Spine-spanning & gutter-overlapping frames cause negative slice dimensions | Pre-clamp obstacles to `pageArea` via `getClampedIntersection` before 4-slice decomposition |
| **Spatial Subtraction** | Rotated elements ($15^\circ, 45^\circ$) collide with auto-layout | Project rotated frames to AABB (`getRotatedAABB`) prior to obstacle calculation |
| **Spatial Subtraction** | `scoreAndSortVariations` falls back to colliding variations | Remove fallback; strictly return `nonColliding` variations |
| **Adaptive Layout** | Narrow free boxes cause sub-pixel or negative frame dimensions | Enforce minimum box dimensions (`box.width >= count * minDimension`) before partitioning |
| **Spread Assembly** | Concatenation pushes excluded overlays behind new photo frames | Preserve original element z-index / visual stacking hierarchy |
| **Keyboard Shortcut `S`** | Typing 's' in inline text editing triggers swap | Add `!isEditingText` and `editingTextElementId === null` guards |
| **Keyboard Shortcut `S`** | Pressing `S` with text nodes selected displays false toast | Validate that both selected elements have `type === 'photo'` and `photoId !== null` |
| **Carousel Parity** | `CarouselCanvas` lacks center draggable cyan swap handle | Implement draggable center swap handle group matching `KonvaEditorCanvas` |
| **Store Parity** | `carouselStore.ts` `swapFrames` does not check `frame.locked` | Add `if (frameA.locked \|\| frameB.locked) return;` guard |

---

## Conclusion & Next Steps
With the inclusion of these 9 architectural specifications and parity safeguards, Phase 19 is fully vetted for implementation across both Print Album and Social Carousel modes.
