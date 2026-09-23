# Phase 13 Research: Interactive In-Canvas Divider Dragging & Direct Photo Swapping

**Domain:** Direct Manipulation Canvas Engine & Tactile Photo Rebalancing  
**Researched:** 2026-09-23  
**Status:** READY FOR PLANNING & IMPLEMENTATION  

---

## Executive Summary

Phase 13 delivers the hallmark tactile editing experiences of elite desktop album suites (**Pixellu SmartAlbums** and **Fundy Designer**):
1. **Interactive In-Canvas Divider Dragging (DIV-01, DIV-02, DIV-03, DIV-05):** Detecting shared boundaries (gaps) between adjacent photo frames in real time, rendering high-contrast hover guidelines (`#38BDF8`), and enabling 60fps/120fps dragging that resizes adjoining frames simultaneously with zero React re-render thrashing, sub-millimeter aspect-fill preservation, and strict clamping ($0.15 \le \alpha \le 0.85$, $W \ge 25.4\text{ mm}$ / $120\text{ px}$).
2. **Direct Photo Drag Swapping (DIV-04):** Dragging an on-canvas photo frame directly over another frame displays a luminous cyan target ring (`#38BDF8`). Dropping the frame swaps the photo payloads (`photoId`, `filePath`, `previewPath`, `photoAspect`) while preserving the frame geometries and recalculating aspect-cover framing, recorded as a single atomic undo/redo transaction.

This research establishes the mathematical models, Konva scene graph mechanics, state management workflows, and edge-case guardrails to implement Phase 13 with zero regressions.

---

## 1. Divider Extraction Algorithm & Topology (DIV-01, DIV-02, DIV-05)

### 1.1 The Geometric Adjacency Problem

Given an arbitrary collection of rectangular photo frames $F = \{f_1, f_2, \dots, f_n\}$ on an album spread or carousel slide, the engine must extract all internal shared boundaries between frames.

Frames may:
- Touch with zero gap ($G = 0$, flush/gapless layout).
- Be separated by a uniform spacing gap $G > 0$ (e.g. $4\text{ mm}$ or $12\text{ px}$).
- Form $1 \times 1$ adjacent pairs, $1 \times K$ splits (hero next to a stacked column), or $M \times N$ grids.
- Be freely positioned or synthesized by R-BSP layout engines.

Rotated frames ($\text{rotation} \neq 0$) and locked frames are excluded from divider generation.

### 1.2 Mathematical Formulation of Adjacency

#### Vertical Dividers (Separating Left Column from Right Column)
Two frames $A$ (left) and $B$ (right) share an adjacent vertical boundary if:
1. **Horizontal Proximity:**
   $$x_B \ge x_A + w_A - \epsilon$$
   $$\text{gap} = x_B - (x_A + w_A) \le G_{\max}$$
   Where $\epsilon \approx 0.5\text{ mm}$ (or $2\text{ px}$) handles floating-point rounding, and $G_{\max} \approx 25\text{ mm}$ (or $60\text{ px}$) prevents matching frames separated by vast empty gutters.
2. **Vertical Overlap:**
   $$y_{\text{start}} = \max(y_A, y_B), \quad y_{\text{end}} = \min(y_A + h_A, y_B + h_B)$$
   $$\text{overlap} = y_{\text{end}} - y_{\text{start}} > \text{minOverlap}$$
   Where $\text{minOverlap} \ge 2.0\text{ mm}$ (or $8\text{ px}$).
3. **Occlusion Non-Interference:**
   No third frame $C$ lies horizontally between $A$ and $B$ in the overlapping vertical interval $[y_{\text{start}}, y_{\text{end}}]$.

The centerline coordinate of the vertical divider is:
$$X_{\text{divider}} = \frac{(x_A + w_A) + x_B}{2} = x_A + w_A + \frac{\text{gap}}{2}$$

#### Horizontal Dividers (Separating Top Row from Bottom Row)
Dual formulation along the Y axis:
1. **Vertical Proximity:**
   $$y_B \ge y_A + h_A - \epsilon$$
   $$\text{gap} = y_B - (y_A + h_A) \le G_{\max}$$
2. **Horizontal Overlap:**
   $$x_{\text{start}} = \max(x_A, x_B), \quad x_{\text{end}} = \min(x_A + w_A, x_B + w_B)$$
   $$\text{overlap} = x_{\text{end}} - x_{\text{start}} > \text{minOverlap}$$
3. **Occlusion Non-Interference:**
   No third frame $C$ lies vertically between $A$ and $B$ in $[x_{\text{start}}, x_{\text{end}}]$.

The centerline coordinate of the horizontal divider is:
$$Y_{\text{divider}} = \frac{(y_A + h_A) + y_B}{2} = y_A + h_A + \frac{\text{gap}}{2}$$

### 1.3 Colinear Segment Merging (Through-Dividers vs T-Junctions)

In professional grid layouts, multiple pairs of frames often share the same colinear boundary:
- **Example A (Through-Divider):** A $2 \times 2$ grid has two vertical pairs: $(F_{00}, F_{01})$ and $(F_{10}, F_{11})$. Both pairs share $X_{\text{divider}} = 150.0\text{ mm}$. Dragging the divider should resize both rows simultaneously as a single continuous through-line.
- **Example B (T-Junction Segment):** A 1-hero left, 2-stacked right layout. The vertical divider spans the full height of the spread. The horizontal divider separating the two right frames terminates at the vertical divider on the left and spread margin on the right. It must only resize the top and bottom right frames.

**Clustering Algorithm:**
1. Extract all pairwise adjacent contacts.
2. Group contacts with identical orientation and matching coordinate ($\left| \text{coord}_1 - \text{coord}_2 \right| \le \epsilon$).
3. Within each group, merge contacts whose orthogonal spans $[start_1, end_1]$ and $[start_2, end_2]$ overlap or connect with a gap $\le G_{\max}$.
4. The resulting `CanvasDivider` spans $[ \min(start), \max(end) ]$ and collects all unique `firstSideFrameIds` and `secondSideFrameIds`.

### 1.4 Data Structure: `CanvasDivider`

```typescript
export interface CanvasDivider {
  /** Deterministic unique ID, e.g. "v-div-150.00-f1,f2-f3,f4" */
  id: string;
  orientation: 'vertical' | 'horizontal';
  /** Centerline coordinate (physical mm in Album, px in Carousel) */
  coord: number;
  /** Span start on orthogonal axis (Y1 for vertical, X1 for horizontal) */
  startCoord: number;
  /** Span end on orthogonal axis (Y2 for vertical, X2 for horizontal) */
  endCoord: number;
  /** Detected inter-frame spacing gap */
  gap: number;
  /** Frame IDs on Left (if vertical) or Top (if horizontal) */
  firstSideFrameIds: string[];
  /** Frame IDs on Right (if vertical) or Bottom (if horizontal) */
  secondSideFrameIds: string[];
  /** Clamped lower bound coordinate for dragging */
  minCoord: number;
  /** Clamped upper bound coordinate for dragging */
  maxCoord: number;
}
```

---

## 2. 60fps Drag Mechanics in Konva (DIV-01, DIV-03, DIV-05)

### 2.1 The React State Thrashing Anti-Pattern

On 120Hz/1000Hz gaming mice and Apple trackpads, dragging an element emits hundreds of pointer events per second.
- **The Problem:** If `onDragMove` dispatches Zustand actions (`batchUpdateFrames`) or React `setState`, React invokes full Virtual DOM reconciliation across all canvas components. Each frame re-renders decoded 45MP bitmap textures, allocates garbage heap objects, and drops the canvas frame rate to **10–15 FPS**.
- **The Solution:** Completely decouple the active dragging loop from React state. **Zero React state updates during drag.**

### 2.2 Scene Graph Layer Separation

Konva canvas architecture must isolate static and dynamic elements across discrete layers:

```
┌────────────────────────────────────────────────────────┐
│ Stage                                                  │
│  ├─ BackgroundLayer (paper sheet, shadow, spine)       │
│  ├─ PhotoLayer (PhotoFrameNodes, images, clip masks)   │
│  └─ InteractionOverlayLayer                            │
│      ├─ DividerHandles (Group with wide hit zone)      │
│      ├─ DragGuideLines & Snap Guides                   │
│      └─ TargetSwapGlowRing (DIV-04 feedback)           │
└────────────────────────────────────────────────────────┘
```

When a divider is dragged, only the `InteractionOverlayLayer` and `PhotoLayer` need to be drawn. `BackgroundLayer` is never repainted.

### 2.3 Drag Loop Lifecycle

```
Pointer Down on Divider Handle
  │
  ▼
[onDragStart]
  ├─ Lock 1D Axis via dragBoundFunc (vertical locks Y, horizontal locks X)
  ├─ Cache initial physical rects of adjacent frames in mutable Ref:
  │    initialGeometriesRef.set(id, { x, y, width, height, photoAspect, cropScale, cropX, cropY })
  ├─ Cache Konva Node pointers via stageRef.findOne('#' + id)
  ├─ Set active cursor ('col-resize' or 'row-resize')
  └─ Highlight divider line (#38BDF8, shadowBlur 8)
  │
  ▼
[onDragMove] (Throttled via requestAnimationFrame)
  ├─ Read current pointer position from divider node: currentPos = dividerNode.x() / scaleFactor
  ├─ Compute delta: Δ = currentPos - initialDividerCoord
  ├─ If RAF already scheduled, return immediately (coalesce to screen refresh rate)
  └─ requestAnimationFrame(() => {
       For each Left/Top frame:
         newW = init.width + Δ
         node.width(newW * scaleFactor)
         Update inner image cover dimensions & offsets imperatively
       For each Right/Bottom frame:
         newX = init.x + Δ
         newW = init.width - Δ
         node.x(newX * scaleFactor)
         node.width(newW * scaleFactor)
         Update inner image cover dimensions & offsets imperatively
       layer.batchDraw()
     })
  │
  ▼
[onDragEnd]
  ├─ Cancel any pending RAF
  ├─ Compute final physical geometries for all affected frames
  ├─ Reset divider handle position
  ├─ Dispatch single atomic store transaction:
  │    Album: editorStore.batchUpdateFrames(spreadId, updates)
  │    Carousel: carouselStore.batchUpdateFrames(updates)
  └─ Automatically commits single undo/redo snapshot to useHistoryStore
```

### 2.4 Imperative Image Cover-Fit Recalculation

When frame dimensions change during divider drag, the image inside must maintain uniform scale and focal centering without distortion:
```typescript
function updateFrameImperative(
  frameNode: Konva.Group,
  newWidthPhysical: number,
  newHeightPhysical: number,
  meta: CachedFrameMeta,
  scaleFactor: number
) {
  const pixelW = newWidthPhysical * scaleFactor;
  const pixelH = newHeightPhysical * scaleFactor;

  // 1. Update frame container node
  frameNode.width(pixelW);
  frameNode.height(pixelH);

  // 2. Update background placeholder
  const bgRect = frameNode.findOne('.frame-bg') as Konva.Rect | undefined;
  if (bgRect) {
    bgRect.width(pixelW);
    bgRect.height(pixelH);
  }

  // 3. Recalculate cover fit and offset preserving normalized focal point
  const { offsetX, offsetY, width: imgW, height: imgH } = calculateImageOffset(
    newWidthPhysical,
    newHeightPhysical,
    meta.photoAspect,
    meta.cropScale,
    meta.cropX,
    meta.cropY
  );

  const imgNode = frameNode.findOne(`.crop-img-${meta.id}`) as Konva.Image | undefined;
  const cropGroup = frameNode.findOne(`#crop-group-${meta.id}`) as Konva.Group | undefined;

  if (imgNode && cropGroup) {
    const renderImgW = imgW * scaleFactor;
    const renderImgH = imgH * scaleFactor;
    const renderOffX = offsetX * scaleFactor;
    const renderOffY = offsetY * scaleFactor;

    cropGroup.x(renderOffX + renderImgW / 2);
    cropGroup.y(renderOffY + renderImgH / 2);

    imgNode.width(renderImgW);
    imgNode.height(renderImgH);
    imgNode.x(-renderImgW / 2);
    imgNode.y(-renderImgH / 2);
  }
}
```

---

## 3. Min/Max Clamping & Zero-Collapse Guarantee (DIV-03)

### 3.1 Closed-Form Mathematical Clamping

To prevent frames from collapsing to zero width/height, inverting coordinates ($W < 0$), or throwing canvas `IndexSizeError` exceptions, every divider enforces two strict constraints:
1. **Absolute Minimum Dimension ($S_{\min}$):**
   - **Print Album Spreads:** $W \ge 25.4\text{ mm}$ ($1.0\text{ inch}$) and $H \ge 25.4\text{ mm}$.
   - **Social Carousels:** $W \ge 120\text{ px}$ and $H \ge 120\text{ px}$.
2. **Harmonic Split Ratio Range ($\alpha \in [0.15, 0.85]$):**
   No photo in an adjacent pairing can be squeezed to less than $15\%$ or expanded to more than $85\%$ of their combined span.

### 3.2 Delta Bounds Derivation

Let vertical divider separate left frames $L$ and right frames $R$.
For any adjacent pair $(i, j)$ with $i \in L, j \in R$:
- Combined usable width: $W_{\text{pair}} = w_i + w_j$.
- Current left width: $w_i$.
- Current right width: $w_j$.
- Allowed new left width: $w_i' = w_i + \Delta$.
- Allowed new right width: $w_j' = w_j - \Delta$.

**Constraint 1 (Left Frame Minimums):**
$$w_i + \Delta \ge S_{\min} \implies \Delta \ge S_{\min} - w_i$$
$$w_i + \Delta \ge 0.15 \cdot W_{\text{pair}} \implies \Delta \ge 0.15 \cdot W_{\text{pair}} - w_i$$
$$\Delta_{\min, i} = \max(S_{\min} - w_i, 0.15 \cdot W_{\text{pair}} - w_i)$$

**Constraint 2 (Right Frame Minimums):**
$$w_j - \Delta \ge S_{\min} \implies \Delta \le w_j - S_{\min}$$
$$w_j - \Delta \ge 0.15 \cdot W_{\text{pair}} \implies \Delta \le w_j - 0.15 \cdot W_{\text{pair}}$$
$$\Delta_{\max, j} = \min(w_j - S_{\min}, w_j - 0.15 \cdot W_{\text{pair}})$$

**Global Divider Bounds:**
$$\Delta_{\min} = \max_{i \in L} \Delta_{\min, i}$$
$$\Delta_{\max} = \min_{j \in R} \Delta_{\max, j}$$

If $\Delta_{\min} > \Delta_{\max}$, the layout is already maximally constrained and no divider movement is permitted.

### 3.3 Konva `dragBoundFunc` Implementation

Konva's `dragBoundFunc` intercepts pointer coordinates before node position is assigned. This provides a hard hardware-level stop:
```typescript
dragBoundFunc: (pos) => {
  const minScreen = divider.minCoord * scaleFactor;
  const maxScreen = divider.maxCoord * scaleFactor;
  if (divider.orientation === 'vertical') {
    return {
      x: Math.max(minScreen, Math.min(maxScreen, pos.x)),
      y: divider.startCoord * scaleFactor, // Lock vertical axis
    };
  } else {
    return {
      x: divider.startCoord * scaleFactor, // Lock horizontal axis
      y: Math.max(minScreen, Math.min(maxScreen, pos.y)),
    };
  }
}
```

---

## 4. Direct Photo Drag Swapping (DIV-04)

### 4.1 Interaction Paradigm

In addition to resizing frames via dividers, users must be able to swap photos instantly by dragging a photo directly onto another frame.

```
┌────────────────────────┐         ┌────────────────────────┐
│ Photo Frame A          │         │ Photo Frame B (Target) │
│ (Drag Source)          │───────► │ ╔════════════════════╗ │
│ Dragged over Frame B   │         │ ║ Cyan Glow Ring     ║ │
│                        │         │ ║ "Drop to Swap"     ║ │
│                        │         │ ╚════════════════════╝ │
└────────────────────────┘         └────────────────────────┘
```

### 4.2 Drop Target Detection Algorithm

1. During `onDragMove` of any photo frame:
   - Compute current center point of the dragged node in spread physical coordinates:
     $$x_{\text{center}} = \frac{\text{node.x()} + \frac{\text{node.width()}}{2}}{\text{scaleFactor}}$$
     $$y_{\text{center}} = \frac{\text{node.y()} + \frac{\text{node.height()}}{2}}{\text{scaleFactor}}$$
   - Call `findPhotoSwapTarget(elements, { x: x_center, y: y_center }, sourceFrameId)`.
   - If a valid target frame is detected:
     - Set `hoveredTargetFrameId = target.id`.
     - Render glowing cyan target ring on `InteractionOverlayLayer`.
   - If pointer leaves target: clear `hoveredTargetFrameId`.

2. On `onDragEnd`:
   - If `hoveredTargetFrameId` is active:
     - **Revert Node Position:** Immediately return dragged Konva node to its origin position:
       `node.position({ x: originX * scaleFactor, y: originY * scaleFactor })`
     - **Swap Payloads:** Execute atomic swap in store:
       `swapFrames(spreadId, sourceId, targetId)`
     - **Preserve Geometry:** Container dimensions ($x, y, w, h$) are completely untouched.
     - **Reset Crop to Proportional Center Cover:**
       `cropX = 0`, `cropY = 0`, `cropScale = 1.0`, `cropRotation = 0`.
     - **Selection & Feedback:** Select target frame, play subtle haptic/audio or toast: `✓ Swapped photos`.
   - If no target: apply standard frame drag move / snapping.

### 4.3 Visual Feedback: Cyan Target Ring Specification

```tsx
{hoveredSwapTargetFrame && (
  <Group listening={false}>
    <Rect
      x={hoveredSwapTargetFrame.x * scaleFactor}
      y={hoveredSwapTargetFrame.y * scaleFactor}
      width={hoveredSwapTargetFrame.width * scaleFactor}
      height={hoveredSwapTargetFrame.height * scaleFactor}
      stroke="#38BDF8"
      strokeWidth={3}
      shadowColor="#38BDF8"
      shadowBlur={12}
      shadowOpacity={0.8}
      cornerRadius={targetCornerRadii}
    />
    <Group
      x={(hoveredSwapTargetFrame.x + hoveredSwapTargetFrame.width / 2) * scaleFactor - 50}
      y={(hoveredSwapTargetFrame.y + hoveredSwapTargetFrame.height / 2) * scaleFactor - 12}
    >
      <Rect
        width={100}
        height={24}
        fill="rgba(14, 165, 233, 0.95)"
        cornerRadius={12}
        shadowColor="rgba(0, 0, 0, 0.4)"
        shadowBlur={6}
        shadowOffset={{ x: 0, y: 2 }}
      />
      <KonvaText
        width={100}
        height={24}
        text="Swap Photo"
        align="center"
        verticalAlign="middle"
        fill="#FFFFFF"
        fontSize={11}
        fontStyle="bold"
        fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif"
      />
    </Group>
  </Group>
)}
```

---

## 5. Store Methods & Transactional Undo/Redo

### 5.1 Print Album Store Integration (`albumStore` / `editorStore`)
- `editorStore.ts` already provides `batchUpdateFrames`:
  ```typescript
  batchUpdateFrames(spreadId: string, updates: Array<{ id: string; geometry: Partial<PhotoFrameElement> }>)
  ```
  It captures `currentAlbum`, pushes a snapshot to `useHistoryStore.getState().pushState(currentAlbum)`, and updates the spread elements in `useAlbumStore`.
- `editorStore.ts` already provides `swapFrames(spreadId, frameIdA, frameIdB)`.

### 5.2 Social Carousel Store Integration (`carouselStore`)
`carouselStore.ts` currently lacks multi-frame batch updates and swap support. Phase 13 will introduce:
1. `batchUpdateFrames(updates: Array<{ id: string; updates: Partial<CarouselPhotoFrame> }>)`
2. `swapFrames(frameIdA: string, frameIdB: string)`

This ensures 100% feature parity between Print Album Spreads and Social Carousel Slides.

---

## 6. Implementation Deliverables & File Architecture

| Deliverable File | Component / Module | Responsibility |
|---|---|---|
| `src/domain/layout/dividerGraph.ts` | Pure TypeScript Domain Module | Detects pairwise adjacency, merges colinear segments, computes `CanvasDivider` graph, calculates `minCoord` / `maxCoord` clamping bounds. 100% pure TS, zero dependency. |
| `src/domain/layout/__tests__/dividerGraph.test.ts` | Test Suite | Unit tests verifying vertical dividers, horizontal dividers, T-junctions, multi-frame column resizing, and clamping bounds. |
| `src/features/editor/DividerOverlayLayer.tsx` | Konva Layer / Component | Renders hit areas, accent lines (`#38BDF8`), handles `dragBoundFunc`, imperative RAF loop, and commits to `editorStore`. |
| `src/features/editor/KonvaEditorCanvas.tsx` | Editor Canvas | Mounts `DividerOverlayLayer`, connects direct frame drag swapping with cyan glow target feedback. |
| `src/features/carousel/CarouselCanvas.tsx` | Carousel Canvas | Mounts divider overlay and direct photo drag swapping for multi-slide carousels. |
| `src/stores/carouselStore.ts` | State Store | Adds `batchUpdateFrames` and `swapFrames` actions. |

---

## 7. Verification Checklist & Success Criteria

- [ ] **DIV-01:** Hovering within $8\text{px}$ of an adjacent photo boundary highlights divider line with `#38BDF8` and changes cursor to `col-resize` or `row-resize`.
- [ ] **DIV-02:** Dragging vertical or horizontal dividers updates adjacent frames in real time at 60fps/120fps with 0 React re-renders.
- [ ] **DIV-03:** Frames are strictly clamped to $\alpha \in [0.15, 0.85]$ and $W, H \ge 25.4\text{ mm}$ ($120\text{ px}$ in carousel). No frame can collapse to 0 or negative dimensions.
- [ ] **DIV-04:** Dragging an on-canvas photo frame over another frame displays a glowing cyan target ring. Dropping swaps photo payloads and resets to aspect-cover fit in a single undo step.
- [ ] **DIV-05:** Releasing a divider commits the new layout to store as a single atomic history transaction (⌘Z undoes the resize in one step).
- [ ] **Aspect Preservation:** Resizing frames via dividers maintains normalized focal points without squashing or anamorphic distortion.
