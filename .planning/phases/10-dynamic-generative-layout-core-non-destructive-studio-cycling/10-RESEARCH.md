# Phase 10: Dynamic Generative Layout Core & Non-Destructive Studio Cycling - Research & Architecture Specification

**Domain:** Algorithmic Generative Layout Partitioner, Hungarian Bipartite Aspect-Matching, Non-Destructive Studio Cycling
**Researched:** 2026-09-23
**Confidence:** HIGH

---

## 1. Executive Summary & Scope Boundary

Phase 10 implements the algorithmic heart of Milestone v1.2.0: a **pure TypeScript geometric partitioner and aspect-matching engine** in `src/domain/layout/` that generates valid, aspect-preserving layouts for any $N \in [1..15]$ photos without static templates. It replaces legacy static presets in both Print Album and Social Carousel modes, introduces non-destructive `Spacebar` / `Shift+Space` layout cycling with zero photo dropping and zero blank frames, and cleanly resolves the conflict between Space-to-cycle and Space-to-pan.

### Requirements Coverage
- `GEN-01`: Layout engine dynamically generates valid aspect-preserving partitions for any $N \in [1..15]$ photos without static fixed-slot templates.
- `GEN-02`: Switching layout variations via `Spacebar` (next) and `Shift+Space` (previous) preserves all $N$ active photos (Zero-Loss Photo Pool Invariant).
- `GEN-03`: No empty or unpopulated placeholder frames (`filePath: ''`) are ever created during layout cycling (Zero-Blank Frame Guarantee).
- `GEN-04`: Optimal bipartite aspect-matching energy minimization ensures landscape photos match horizontal slots and portrait photos match vertical slots.
- `GEN-05`: Equal-height row normalization and equal-width column normalization align multi-photo strips with 0px rounding seams and proportional aspect-fill cover.
- `GEN-06`: Input disambiguation cleanly distinguishes single-tap `Spacebar` (cycle layout) from `Space + Drag` (canvas hand pan).

---

## 2. Forensic Analysis of Current Implementation

### 2.1 The Root Cause of User-Reported Bugs
1. **Destructive Template Application in `carouselLayout.ts`:**
   `CAROUSEL_LAYOUT_PRESETS` only defined fixed templates for $N \in \{1, 2, 3, 4\}$ photos.
   - When a slide had 7 photos and a user clicked a 2-photo template (e.g. `split_horizontal`), the generator only generated 2 frames from `photos[0]` and `photos[1]`. The remaining 5 photos were silently dropped from the slide!
   - Conversely, if a slide had 1 photo and the user clicked a 4-photo preset (`grid_4_quad`), `createFrame(photos[1], ...)` evaluated with `photos[i] === undefined`. This initialized frames with `filePath: ''` and `photoId: undefined`, rendering dark gray blank rectangles on canvas.
2. **Spacebar Key Conflict in `LayoutCycleHUD.tsx` vs `KonvaEditorCanvas.tsx`:**
   - In `src/features/editor/KonvaEditorCanvas.tsx`, holding `Space` enables canvas hand pan (`isSpacePressed = true`).
   - However, in `src/features/editor/LayoutCycleHUD.tsx`:
     ```typescript
     if (e.code === 'Space') {
       e.preventDefault();
       if (e.shiftKey) handlePrev(); else handleNext();
     }
     ```
     Because this listener triggered on `keydown`, holding Space to pan immediately fired `cycleSpreadLayout` on key press before any mouse movement could occur. This made Space-to-pan jerky or broke layout cycling.
3. **Absence of Hungarian Bipartite Assignment for $N \ge 8$ in `adaptiveLayout.ts`:**
   In `src/domain/adaptiveLayout.ts`, counts $N \le 7$ used a branch-and-bound permutation search, but counts $N \ge 8$ fell back to a greedy heuristic. Greedy matching makes irreversible local choices that can trap high-priority hero photos in tiny thumbnail slots or force severe orientation mismatches.
4. **Lack of Equal-Height / Equal-Width Normalizers:**
   The partitioner did not utilize Knuth-Plass justified row or vertical masonry normalization with cumulative edge snapping, making horizontal strips of photos with varying natural aspect ratios prone to either non-uniform gaps or fractional sub-pixel rounding seams.

---

## 3. Architecture of `src/domain/layout/`

The new domain package `src/domain/layout/` consists of four focused, pure TypeScript modules with zero external runtime dependencies:

```
src/domain/layout/
├── bspEngine.ts             # Slicing tree decomposition with harmonic editorial ratios
├── rowColumnNormalizer.ts   # Justified equal-height row and equal-width column solvers
├── aspectMatcher.ts         # Hungarian algorithm (O(N^3)) & log-aspect cost minimization
├── generator.ts             # Unified facade producing strictly N slots for N photos
└── __tests__/               # High-speed tsx algorithmic test suite
```

### 3.1 `bspEngine.ts` (Recursive Binary Space Partitioning)

#### Core Data Structures
```typescript
import { RectBounds } from '../templates';

export type SplitAxis = 'horizontal' | 'vertical';

export interface BspSplitNode {
  type: 'split';
  axis: SplitAxis;
  ratio: number; // e.g. 0.618, 0.5, 0.667
  left: BspNode;
  right: BspNode;
  bounds: RectBounds;
}

export interface BspLeafNode {
  type: 'leaf';
  bounds: RectBounds;
  slotIndex: number;
}

export type BspNode = BspSplitNode | BspLeafNode;

export interface BspPartitionOptions {
  container: RectBounds;
  leafCount: number;
  spacing: number;
  variantIndex?: number;
  minSlotDimension?: number; // hard lower bound (e.g. 1.0 inch / 25mm / 60px)
  maxDepth?: number;
}
```

#### Harmonic Editorial Ratios
Instead of random cuts, the slicing tree chooses from professional editorial proportions:
- **Golden Ratio Hero:** $\alpha \in \{0.618, 0.382\}$ (classic focal hero with companion stack)
- **Two-Thirds Rule:** $\alpha \in \{0.667, 0.333\}$
- **Symmetric Balance:** $\alpha = 0.500$
- **Three-Quarter Cinematic:** $\alpha \in \{0.750, 0.250\}$

#### Slicing Operators with Integer/Discrete Rounding
For bounding box $B = (x, y, w, h)$, axis $A$, split ratio $\alpha$, and spacing $G$:
- **Vertical Split ($A = \text{'vertical'}$):**
  $$w_{\text{left}} = \text{round4}((w - G) \cdot \alpha)$$
  $$w_{\text{right}} = \text{round4}(w - G - w_{\text{left}})$$
  $$B_{\text{left}} = (x, y, w_{\text{left}}, h), \quad B_{\text{right}} = (x + w_{\text{left}} + G, y, w_{\text{right}}, h)$$
- **Horizontal Split ($A = \text{'horizontal'}$):**
  $$h_{\text{top}} = \text{round4}((h - G) \cdot \alpha)$$
  $$h_{\text{bottom}} = \text{round4}(h - G - h_{\text{top}})$$
  $$B_{\text{top}} = (x, y, w, h_{\text{top}}), \quad B_{\text{bottom}} = (x, y + h_{\text{top}} + G, w, h_{\text{bottom}})$$

#### Minimum Dimension Guardrails
Any cut resulting in $w_i < \text{minSlotDimension}$ or $h_i < \text{minSlotDimension}$ is rejected or clamped, preventing sliver collapse on high photo counts ($N \ge 10$).

---

### 3.2 `rowColumnNormalizer.ts` (Equal-Height Row & Equal-Width Column Solvers)

Multi-photo strips must preserve natural aspect ratios without seam gaps or letterboxing.

#### 1. Equal-Height Row Normalization (Justified Strip)
Given target container width $W_{\text{target}}$, spacing $G$, photo count $k$, and native aspect ratios $r_1, \dots, r_k$ where $r_i = w_i / h_i$:
$$H_{\text{row}} = \frac{W_{\text{target}} - (k - 1) \cdot G}{\sum_{i=1}^k r_i}$$

To prevent 0.5px to 1px rounding seams (Pitfall 1), slot boundaries must use cumulative edge rounding:
$$X_{\text{edge}}(i) = \text{round4}\left( X_{\text{start}} + \sum_{j=1}^i (H_{\text{row}} \cdot r_j) + (i - 1) \cdot G \right)$$
$$w_i = \text{round4}(X_{\text{edge}}(i) - X_{\text{edge}}(i - 1) - G) \quad (\text{with } X_{\text{edge}}(0) = X_{\text{start}})$$

#### 2. Equal-Width Column Normalization (Vertical Masonry Strip)
Given target container height $H_{\text{target}}$, spacing $G$, photo count $m$, and native aspect ratios $r_1, \dots, r_m$:
$$W_{\text{col}} = \frac{H_{\text{target}} - (m - 1) \cdot G}{\sum_{j=1}^m \frac{1}{r_j}}$$
$$Y_{\text{edge}}(j) = \text{round4}\left( Y_{\text{start}} + \sum_{l=1}^j \frac{W_{\text{col}}}{r_l} + (j - 1) \cdot G \right)$$
$$h_j = \text{round4}(Y_{\text{edge}}(j) - Y_{\text{edge}}(j - 1) - G)$$

#### API Signatures
```typescript
export function normalizeEqualHeightRow(
  container: RectBounds,
  photoAspects: number[],
  spacing: number,
  maxHeight?: number
): RectBounds[];

export function normalizeEqualWidthColumn(
  container: RectBounds,
  photoAspects: number[],
  spacing: number,
  maxWidth?: number
): RectBounds[];
```

---

### 3.3 `aspectMatcher.ts` (Hungarian / Kuhn-Munkres Algorithm & Energy Minimization)

Given $N$ photos with aspect ratios $P_i$ and $N$ frame slots with aspect ratios $S_j$:

#### Scale-Invariant Log-Aspect Cost Metric
$$C_{\text{aspect}}(i, j) = \left| \ln(P_i) - \ln(S_j) \right|$$
*Advantage:* Treats an inverted ratio (3:2 in 2:3) with identical symmetric penalty as a 2:3 in 3:2 ($\ln(1.5 / 0.667) = \ln(2.25) \approx 0.81$).

#### Orientation Mismatch Penalty
$$C_{\text{orient}}(i, j) = \begin{cases} 0 & \text{if } (P_i \ge 1.0 \land S_j \ge 1.0) \lor (P_i < 1.0 \land S_j < 1.0) \\ 2.5 & \text{otherwise (cross-orientation crop hazard)} \end{cases}$$

#### Hero Importance Bias
If photo $i$ has high user star rating ($\text{rating} \ge 4$) or `isFavorite === true`, prioritize placing it in larger slots:
$$C_{\text{hero}}(i, j) = \text{heroWeight}_i \cdot \left(1.0 - \frac{\text{Area}(S_j)}{\text{Area}_{\max}}\right) \cdot 1.5$$

#### Total Edge Cost
$$C_{ij} = C_{\text{aspect}}(i, j) + C_{\text{orient}}(i, j) + C_{\text{hero}}(i, j)$$

#### Hungarian / Kuhn-Munkres Implementation in Pure TypeScript
For $N \le 15$, Kuhn-Munkres solves the assignment problem globally in $O(N^3)$ operations ($15^3 = 3375$ iterations, executing in $< 0.05\text{ms}$). This eliminates the greedy local minima trap without risking recursion overhead.

```typescript
export interface PhotoAspectInput {
  aspect: number;
  rating?: number;
  isFavorite?: boolean;
}

export interface MatchResult {
  mapping: number[]; // photo[i] -> slot[mapping[i]]
  score: number; // 0..100 composite visual harmony score
  avgCropPenalty: number; // 0.0 (perfect fit) to 1.0 (severe crop)
}

export function solveHungarianAssignment(costMatrix: number[][]): number[];

export function matchPhotosToSlots(
  photos: PhotoAspectInput[],
  slots: RectBounds[]
): MatchResult;
```

---

### 3.4 `generator.ts` (Unified Generative Facade)

The unified facade accepts arbitrary container bounds and an array of $N$ photos ($N \in [1..15]$). It produces a ranked list of aesthetic `AdaptiveLayoutVariation` candidates, guaranteeing:
1. `variation.rects.length === photos.length`
2. Every rect is matched to an active photo via `photoAssignments`.
3. Zero blank frames and zero photo dropping.

```typescript
export interface LayoutGeneratorOptions {
  containerWidth: number;
  containerHeight: number;
  spacing: number;
  isSpread: boolean;
  isCover?: boolean;
  gutterWidth?: number;
  safeMarginTop?: number;
  safeMarginBottom?: number;
  safeMarginOutside?: number;
  safeMarginSpine?: number;
  lockedElements?: PhotoFrameElement[];
}

export function generateDynamicVariations(
  options: LayoutGeneratorOptions,
  photos: AdaptivePhoto[]
): AdaptiveLayoutVariation[];
```

#### Multi-Archetype Strategy by Density Tier:
- **Tier 1 ($N = 1$):** Full Bleed, Safe Margin Hero, Centered Mat.
- **Tier 2 ($N = 2$):** Horizontal Stack (Equal-Height), Vertical Split (Equal-Width), Asymmetric Golden Hero Left/Right.
- **Tier 3 ($N \in [3..6]$):** Aspect-Aware BSP slicing with Golden ratios ($0.618, 0.5, 0.667$), Triptych Row/Column strips via `rowColumnNormalizer`.
- **Tier 4 ($N \in [7..15]$):**
  - *Spread Mode:* Left/Right page combinatorial splits $(n_L, n_R)$ where $n_L + n_R = N$.
  - *Slide Mode:* Hero + Filmstrip Grid (1 dominant hero + $N-1$ thumbnail slots), Masonry Matrix ($3\times 3, 4\times 3, 5\times 3$), Balanced BSP.

---

## 4. Integration into Stores

### 4.1 `editorStore.ts` & `albumStore.ts`
1. In `src/stores/editorStore.ts`:
   Add `cycleLayout(direction: 'next' | 'prev')`.
   - Accesses active spread from `albumStore`.
   - Collects active photo frames (`filePath !== ''`).
   - Delegates to `albumStore.cycleSpreadLayout(activeSpread.id, direction, currentProject)` or directly invokes `generateDynamicVariations`.
   - Guarantees that only non-empty, assigned photos are passed to the generator.
2. In `src/stores/albumStore.ts`:
   Refactor `cycleSpreadLayout` to call `generateDynamicVariations` from `src/domain/layout/generator.ts`.
   - Strictly ensures `newUnlockedElements` length equals `unlockedPhotos.length`.

### 4.2 `carouselStore.ts`
1. Add `slideLayoutIndices: Record<number, number>` to `CarouselState`.
2. Add `cycleSlideLayout(direction: 'next' | 'prev')`:
   - Inspects `slides[activeSlideIndex]`.
   - Gathers existing photos on the slide:
     ```typescript
     const activePhotos = slide.elements
       .filter((el): el is CarouselPhotoFrame => el.type === 'photo' && Boolean(el.filePath))
       .map((el) => ({ ... }));
     ```
   - If `activePhotos.length === 0`, no-op.
   - Invokes `generateDynamicVariations({ containerWidth: slideWidthPx, containerHeight: slideHeightPx, spacing: 16, isSpread: false }, activePhotos)`.
   - Updates `slide.elements` with exactly $N$ frames populated from `activePhotos`.
   - Increments / decrements `slideLayoutIndices[activeSlideIndex]`.
   - Completely eliminates `CAROUSEL_LAYOUT_PRESETS` dropping photos or adding `filePath: ''` frames.

### 4.3 `TemplatesPanel.tsx`
1. For Carousel Mode (`activeMode === 'carousel'`):
   - Replace static preset iteration with dynamic variations generated for `carouselPhotos`.
   - Display dynamic mini SVG cards with score badges, layout index `#1`, `#2`, and slot previews matching the slide ratio (1:1, 4:5, 9:16).
   - If `carouselPhotos.length === 0`, show informative empty state: "Drag photos onto slide to generate dynamic layouts."

---

## 5. Keyboard Disambiguation: Spacebar Tap vs Space-to-Pan

### 5.1 The Interaction Conflict
- **Requirement:**
  - `Spacebar` (single tap) $\to$ Cycle next layout.
  - `Shift + Spacebar` (single tap) $\to$ Cycle previous layout.
  - `Space + Drag` (hold Space and drag canvas with mouse) $\to$ Pan canvas hand tool.
- **Problem:** If layout cycling triggers on `keydown` of `Space`, it fires before the user can move the mouse to pan.

### 5.2 Disambiguation State Machine
In `src/features/workspace/WorkspaceLayout.tsx`:
1. **On `keydown` (`e.code === 'Space'`):**
   - Guard: Ignore if user is inside `<input>`, `<textarea>`, `isContentEditable`, or if `editingCropFrameId !== null`.
   - If `e.repeat` (key held), return early.
   - `e.preventDefault()` to prevent standard browser scroll.
   - Store timestamp: `spaceDownTimeRef.current = performance.now()`.
   - Record `isSpaceHeldRef.current = true`.
   - Record `hasDraggedRef.current = false`.
   - Record `shiftHeldRef.current = e.shiftKey`.
   - Forward `isSpacePressed = true` to canvas / editorStore (enables hand cursor).
2. **On Pointer Movement (`mousemove` / `pointermove`):**
   - If `isSpaceHeldRef.current` and mouse button is pressed (`e.buttons > 0`):
     - Calculate movement delta: if $\sqrt{\Delta x^2 + \Delta y^2} > 3\text{px}$, mark `hasDraggedRef.current = true`.
     - Pan canvas viewport.
3. **On `keyup` (`e.code === 'Space'`):**
   - Guard: Ignore if inside editable input.
   - Forward `isSpacePressed = false` to canvas (reverts hand cursor).
   - If `isSpaceHeldRef.current`:
     - `isSpaceHeldRef.current = false`.
     - Elapsed time: $\Delta t = \text{performance.now()} - \text{spaceDownTimeRef.current}$.
     - If `!hasDraggedRef.current` and $\Delta t < 600\text{ms}$:
       - **Clean Tap Confirmed!**
       - Trigger layout cycle:
         ```typescript
         const direction = shiftHeldRef.current ? 'prev' : 'next';
         if (activeMode === 'carousel') {
           useCarouselStore.getState().cycleSlideLayout(direction);
         } else {
           useEditorStore.getState().cycleLayout(direction);
         }
         ```
4. **Remove Competing Listener:**
   - Remove the direct `Space` keydown listener in `src/features/editor/LayoutCycleHUD.tsx` so `WorkspaceLayout.tsx` remains the authoritative keyboard dispatcher.

---

## 6. Zero-Blank & Zero-Loss Invariant Specification

To mathematically prevent the bugs observed in Phase 9:

1. **Photo Count Invariant:**
   $$\forall \text{ variation } V, \quad |V.\text{rects}| \equiv N = |\text{photos}|$$
   The partitioner must NEVER generate $K \ne N$ slots.
2. **Photo Binding Invariant:**
   $$\forall j \in [0..N-1], \quad \text{frame}_j.\text{filePath} \ne '' \land \text{frame}_j.\text{photoId} \ne \text{null}$$
   Every slot is mapped to a valid photo from the incoming pool via Hungarian permutation $\pi$.
3. **Cycle Invariance:**
   For any sequence of $M$ consecutive cycles via `Spacebar`:
   $$\text{Set}(\text{photoIds on spread at } t = 0) \equiv \text{Set}(\text{photoIds on spread at } t = M)$$
   Photos are only rearranged, never deleted or replaced with blank placeholders.

---

## 7. Verification Plan & Test Strategy

### 7.1 Automated Unit Tests via `npx tsx`

Create test suites in `src/domain/layout/__tests__/`:

1. `bspEngine.test.ts`:
   - Validates slicing tree generation for all $N \in [1..15]$.
   - Asserts non-overlapping bounding boxes ($\forall i \ne j, \text{intersect}(r_i, r_j) = \text{false}$).
   - Asserts 100% containment within outer container.
   - Verifies harmonic ratio splits ($0.618, 0.5, 0.667$).
   - Verifies enforcement of `minSlotDimension`.
2. `rowColumnNormalizer.test.ts`:
   - Tests `normalizeEqualHeightRow` with various landscape and portrait mixtures.
   - Verifies 0px rounding gap: $\sum w_i + (k - 1)G \equiv W_{\text{target}}$ to within $10^{-4}$.
   - Tests `normalizeEqualWidthColumn`.
3. `aspectMatcher.test.ts`:
   - Tests Hungarian / Kuhn-Munkres assignment.
   - Verifies portrait photo (0.67) assigned to portrait slot (0.67) and landscape (1.5) to landscape slot (1.5).
   - Verifies 5-star hero photo placed into maximum area slot.
4. `generator.test.ts`:
   - Tests unified generator across single-slide and 2-page spread modes for $N \in [1..15]$.
   - Asserts $|rects| === photos.length$ for every variation.
   - Verifies variations are sorted by score descending.
5. `zeroBlankInvariant.test.ts`:
   - Simulates 50 consecutive `cycleSpreadLayout` and `cycleSlideLayout` calls on 1, 3, 5, 7, and 12 photos.
   - Asserts `filePath !== ''` on every element after every cycle.
   - Asserts photo pool set equality after 50 cycles.

### 7.2 Verification Commands
```bash
# Run unit tests
npx tsx src/domain/layout/__tests__/bspEngine.test.ts
npx tsx src/domain/layout/__tests__/rowColumnNormalizer.test.ts
npx tsx src/domain/layout/__tests__/aspectMatcher.test.ts
npx tsx src/domain/layout/__tests__/generator.test.ts
npx tsx src/domain/layout/__tests__/zeroBlankInvariant.test.ts

# Strict TypeScript check
npm run test # (tsc --noEmit)
```

---

## 8. Summary for the Planner

Phase 10 has a clear, isolated implementation plan:
1. **Plan 10-1:** Pure TS layout engine modules: `bspEngine.ts`, `rowColumnNormalizer.ts`, `aspectMatcher.ts`, and `generator.ts` with comprehensive unit tests.
2. **Plan 10-2:** Carousel dynamic layout integration: update `carouselStore.ts`, replace static presets with dynamic $N$-photo variations in `TemplatesPanel.tsx`, eliminate blank frame creation.
3. **Plan 10-3:** Store layout cycling & Spacebar input disambiguation: implement `cycleLayout` in `editorStore.ts` and `cycleSlideLayout` in `carouselStore.ts`, hook tap-vs-drag disambiguation in `WorkspaceLayout.tsx`, remove conflicting listener in `LayoutCycleHUD.tsx`.
