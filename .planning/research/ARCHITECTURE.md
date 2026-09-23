# Architecture Research

**Domain:** Desktop Photo Layout Engine & Automated Storytelling (OpenSmartAlbum-MacOS)  
**Researched:** 2026-09-23  
**Confidence:** HIGH  

---

## Executive Summary

Milestone v1.2.0 ("Unlimited Studio Layout & Storytelling Engine") transitions OpenSmartAlbum from a dual-engine paradigm—where Print Albums rely on recursive combinatorial partitioning in [`adaptiveLayout.ts`](file:///Users/chiio/VSCode/albumaker/src/domain/adaptiveLayout.ts) and Social Carousels rely on static hand-coded presets in [`carouselLayout.ts`](file:///Users/chiio/VSCode/albumaker/src/domain/carouselLayout.ts)—into a **unified, surface-agnostic Generative Layout Engine**. 

Furthermore, this milestone introduces **Dynamic Partition Trees with Interactive In-Canvas Dividers** (allowing real-time dragging of slot boundaries in Konva.js) and a **Worker-Driven Auto-Flow Storytelling Pipeline** capable of clustering, pacing, and laying out 200+ photos across dozens of spreads or slides without dropping a single frame of the 60fps UI loop.

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Presentation & Interaction Layer                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────┐  ┌─────────────────────────┐  ┌─────────────┐  │
│  │   KonvaEditorCanvas     │  │     CarouselCanvas      │  │  Templates  │  │
│  │   (Print Album Spread)  │  │    (Multi-Slide Pan)    │  │    Panel    │  │
│  └────────────┬────────────┘  └────────────┬────────────┘  └──────┬──────┘  │
│               │                            │                      │         │
│               ▼                            ▼                      │         │
│  ┌──────────────────────────────────────────────────────────┐     │         │
│  │              Interactive Divider Overlay Layer           │◄────┘         │
│  │         (Konva Rects/Lines, Hitboxes, Cursor Hooks)      │               │
│  └────────────────────────────┬─────────────────────────────┘               │
├───────────────────────────────┼─────────────────────────────────────────────┤
│                               ▼                                             │
│                       State Management Layer                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────┐  ┌─────────────────────────┐  ┌─────────────┐  │
│  │       albumStore        │  │      carouselStore      │  │ editorStore │  │
│  │    (Album, Spreads)     │  │    (Carousel, Slides)   │  │ (Selection, │  │
│  │                         │  │                         │  │  Dividers)  │  │
│  └────────────┬────────────┘  └────────────┬────────────┘  └──────┬──────┘  │
│               │                            │                      │         │
├───────────────┴────────────────────────────┴──────────────────────┴─────────┤
│                     Surface Adapter & Normalization Layer                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │            LayoutSurfaceContext (Abstract Geometric Surface)          │   │
│  │       - Normalized Dimensions, Unit & DPI, Safe Insets, Spacing      │   │
│  │       - Logical Segments (Pages / Slides), Gutters / Fold Lines      │   │
│  └──────────────────────────────────┬───────────────────────────────────┘   │
├─────────────────────────────────────┼───────────────────────────────────────┤
│                                     ▼                                       │
│                     Core Generative Layout Engine                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────┐  ┌─────────────────────────┐  ┌─────────────┐  │
│  │ Binary Space Partition  │  │  Aspect Scoring Engine  │  │  LRU Cache  │  │
│  │      (BSP Slicing)      │  │  (Crop Penalty & Hero)  │  │  (Keyed by  │  │
│  │                         │  │   Bipartite Assignment  │  │  Signature) │  │
│  └─────────────────────────┘  └─────────────────────────┘  └─────────────┘  │
├─────────────────────────────────────────────────────────────────────────────┤
│                     Background Processing Layer (Web Worker)                │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                layoutEngine.worker.ts (Off-Main-Thread)              │   │
│  │    - Chronological & Time-Delta Event Clustering (EXIF Ingestion)   │   │
│  │    - Narrative Pacing & Page Budgeting (1..6 photos/spread)          │   │
│  │    - Parallel Combinatorial Variation Evaluation                     │   │
│  │    - Progressive Chunked Streaming (Zero Main-Thread Freezes)        │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation Pattern |
|-----------|----------------|------------------------|
| **`LayoutSurfaceContext`** | Normalizes differences between print spreads (mm/in/spine) and carousel slides (px/slice boundaries) into a unified coordinate and partition space. | TypeScript pure interface & mapping adapter functions in `src/domain/layout/surfaceAdapter.ts`. |
| **`UnifiedLayoutEngine`** | Generates non-overlapping geometric partitions ($N \in [1..15]$ photos), handles locked element avoidance, computes crop penalties, and pairs photos to slots. | Pure functional module extracted from [`adaptiveLayout.ts`](file:///Users/chiio/VSCode/albumaker/src/domain/adaptiveLayout.ts) and extended with multi-segment slicing. |
| **`LayoutPartitionTree`** | Encapsulates the hierarchical Binary Space Partitioning (BSP) tree of slots and dynamic split lines for a spread or slide. | Immutable tree data structure with split nodes, ratios, and leaf slot nodes in `src/domain/layout/partitionTree.ts`. |
| **`InteractiveDividerOverlay`** | Renders divider drag handles and hitboxes on the Konva canvas, detects hover/drag gestures, and updates split ratios. | React-Konva `<Layer>` component sharing coordinates with [`KonvaEditorCanvas.tsx`](file:///Users/chiio/VSCode/albumaker/src/features/editor/KonvaEditorCanvas.tsx) and [`CarouselCanvas.tsx`](file:///Users/chiio/VSCode/albumaker/src/features/carousel/CarouselCanvas.tsx). |
| **`editorStore` (Divider slice)** | Manages active drag state, clamped ratios, snap positions, and pushes atomic undo/redo steps to `historyStore`. | Zustand store slice in [`src/stores/editorStore.ts`](file:///Users/chiio/VSCode/albumaker/src/stores/editorStore.ts). |
| **`layoutEngine.worker.ts`** | Executes compute-heavy multi-spread auto-flow algorithms (clustering, pacing, permutation solving) without blocking main thread. | Native ESM Web Worker loaded via Vite `new Worker(new URL(..., import.meta.url), { type: 'module' })`. |
| **`AutoFlowController`** | Orchestrates ingestion, chunked messaging with Web Worker, progress state, and batch state insertion into `albumStore`/`carouselStore`. | Service singleton/hook in `src/features/autoflow/AutoFlowController.ts`. |

---

## Recommended Project Structure

```
src/
├── domain/
│   ├── layout/                          # Unified Generative Layout Subsystem
│   │   ├── surfaceAdapter.ts            # Adapts Spread & Carousel to LayoutSurfaceContext
│   │   ├── partitionTree.ts             # BSP Tree data structures, split nodes & slots
│   │   ├── dividerModel.ts              # Interactive divider geometry & clamp calculations
│   │   ├── dynamicPartitioner.ts        # K-rects recursive & combinatorial BSP generator
│   │   ├── aspectScorer.ts              # Orientation fingerprinting, crop penalty & bipartite solver
│   │   ├── layoutRecipes.ts             # Curated presets & editorial templates as BSP trees
│   │   └── index.ts                     # Public domain facade
│   ├── storytelling/                    # Auto-Flow Narrative Engine
│   │   ├── timeClusterer.ts             # EXIF timestamp & time-delta burst detection
│   │   ├── pacingEngine.ts              # Rhythm rules (hero spreads, breathing space, grids)
│   │   └── autoFlowPipeline.ts          # End-to-end ingestion plan generator
│   ├── adaptiveLayout.ts                # (Legacy facade / backward compatibility wrapper)
│   ├── carouselLayout.ts                # (Legacy facade / preset registry wrapper)
│   └── editor.ts                        # Core frame, text, and shape definitions
├── workers/
│   ├── layoutEngine.worker.ts           # Dedicated Web Worker for layout search & auto-flow
│   └── workerMessages.ts                # Strongly typed Request/Response message contracts
├── stores/
│   ├── albumStore.ts                    # Album & spread persistence, layout mutation actions
│   ├── carouselStore.ts                 # Carousel & slide state, ratio scaling, slice mutations
│   ├── editorStore.ts                   # Selection, crop, snap lines, and active divider drag state
│   └── historyStore.ts                  # Command undo/redo stack
├── features/
│   ├── editor/
│   │   ├── KonvaEditorCanvas.tsx        # Main spread canvas with divider integration
│   │   └── overlays/
│   │       └── InteractiveDividers.tsx  # Konva overlay rendering split lines & drag handles
│   ├── carousel/
│   │   └── CarouselCanvas.tsx           # Multi-slide canvas with divider integration
│   ├── autoflow/
│   │   ├── AutoFlowModal.tsx            # Wizard UI: photo selection, pacing, style presets
│   │   ├── AutoFlowProgress.tsx         # Progressive progress bar with spread previews
│   │   └── useAutoFlow.ts               # Hook interfacing React UI with layoutEngine.worker
│   └── templates/
│       └── TemplatesPanel.tsx           # Unified visual variation selector for both modes
```

### Structure Rationale

- **`src/domain/layout/` isolation:** Decouples geometric partitioning and aspect scoring from React components and Zustand stores. Both Print and Carousel modes consume the same underlying engine via adapters, eliminating duplicated layout code.
- **`src/workers/` separation:** Keeps off-main-thread worker code pure and free of DOM or canvas imports. Worker code must be bundleable independently by Vite without pulling in Konva or React.
- **`src/features/editor/overlays/` modularity:** Isolates interactive divider hit-testing and dragging into reusable Konva sub-layers so neither `KonvaEditorCanvas.tsx` nor `CarouselCanvas.tsx` become further bloated.

---

## Architectural Patterns

### Pattern 1: Abstract Surface Adapter (Unifying Print Album and Social Carousel)

**What:** An adapter layer that converts heterogeneous layout targets—whether a Print Spread (`pageWidth * 2 + gutterWidth` in mm, spine margin, cover variants) or a Social Carousel ($N$ slides in px, slice cut lines)—into a normalized `LayoutSurfaceContext`. The core layout engine produces a generic `SlotLayoutResult`, which the adapter transforms back into mode-specific frame models (`PhotoFrameElement` or `CarouselPhotoFrame`).

**When to use:** Whenever generating layout variations, cycling templates, or applying dynamic partitions, regardless of project type.

**Trade-offs:** Adds an abstraction translation step, but completely eliminates divergent layout logic, reduces duplicate code across [`adaptiveLayout.ts`](file:///Users/chiio/VSCode/albumaker/src/domain/adaptiveLayout.ts) and [`carouselLayout.ts`](file:///Users/chiio/VSCode/albumaker/src/domain/carouselLayout.ts), and enables cross-mode template sharing (e.g., using a 2-page wedding spread layout as a 2-slide Instagram panorama).

**Example:**
```typescript
// src/domain/layout/surfaceAdapter.ts

export interface LayoutSurfaceContext {
  id: string;
  mode: 'print' | 'carousel';
  totalWidth: number;
  totalHeight: number;
  unit: 'px' | 'mm' | 'in';
  dpi: number;
  spacing: number;
  // Discrete viewports (pages in a spread, or slides in a carousel)
  segments: Array<{
    index: number;
    bounds: RectBounds;
    safeBounds: RectBounds;
    isSpanningAllowed: boolean;
  }>;
  // Natural boundaries that dividers can align with (spine or slide cuts)
  seams: Array<{
    coordinate: number;
    orientation: 'vertical' | 'horizontal';
    isPhysicalFold: boolean; // true for book spine, false for carousel virtual cut
  }>;
  lockedZones: RectBounds[];
}

export function adaptSpreadToSurfaceContext(spread: Spread, project: Project): LayoutSurfaceContext {
  const dims = getProjectDimensionsInCanvasUnit(project, spread);
  const isCover = !spread.leftPage || !spread.rightPage;
  const pageWidth = spread.leftPage ? spread.leftPage.width : dims.pageWidth;
  const gutterWidth = isCover ? 0 : (spread.gutterWidth ?? dims.gutterWidth);
  const totalW = isCover ? pageWidth : pageWidth * 2 + gutterWidth;
  const totalH = dims.pageHeight;
  const spineX = pageWidth + gutterWidth / 2;

  const lockedFrames = (spread.elements || [])
    .filter((el): el is PhotoFrameElement => el.type === 'photo' && Boolean(el.locked))
    .map((el) => ({ x: el.x, y: el.y, width: el.width, height: el.height }));

  return {
    id: spread.id,
    mode: 'print',
    totalWidth: totalW,
    totalHeight: totalH,
    unit: project.canvasUnit || 'mm',
    dpi: project.canvasDpi || 300,
    spacing: convertUnit(spread.spacingValue ?? project.spacingValue ?? 2, spread.spacingUnit ?? 'mm', project.canvasUnit, dims.dpi),
    segments: isCover
      ? [{ index: 0, bounds: { x: 0, y: 0, width: totalW, height: totalH }, safeBounds: { x: dims.safeMargin, y: dims.safeMargin, width: totalW - dims.safeMargin * 2, height: totalH - dims.safeMargin * 2 }, isSpanningAllowed: false }]
      : [
          { index: 0, bounds: { x: 0, y: 0, width: pageWidth, height: totalH }, safeBounds: { x: dims.safeMarginOutside, y: dims.safeMarginTop, width: pageWidth - dims.safeMarginOutside - dims.safeMarginSpine, height: totalH - dims.safeMarginTop - dims.safeMarginBottom }, isSpanningAllowed: true },
          { index: 1, bounds: { x: pageWidth + gutterWidth, y: 0, width: pageWidth, height: totalH }, safeBounds: { x: pageWidth + gutterWidth + dims.safeMarginSpine, y: dims.safeMarginTop, width: pageWidth - dims.safeMarginOutside - dims.safeMarginSpine, height: totalH - dims.safeMarginTop - dims.safeMarginBottom }, isSpanningAllowed: true },
        ],
    seams: isCover ? [] : [{ coordinate: spineX, orientation: 'vertical', isPhysicalFold: true }],
    lockedZones: lockedFrames,
  };
}

export function adaptCarouselToSurfaceContext(carousel: Carousel, activeIndex: number, spanSlides = 1): LayoutSurfaceContext {
  const slideW = carousel.slideWidthPx;
  const slideH = carousel.slideHeightPx;
  const startX = activeIndex * slideW;
  const totalW = slideW * spanSlides;

  const seams = [];
  for (let i = 1; i < spanSlides; i++) {
    seams.push({ coordinate: startX + i * slideW, orientation: 'vertical' as const, isPhysicalFold: false });
  }

  return {
    id: `carousel-slice-${activeIndex}-${spanSlides}`,
    mode: 'carousel',
    totalWidth: totalW,
    totalHeight: slideH,
    unit: 'px',
    dpi: 72,
    spacing: 16,
    segments: Array.from({ length: spanSlides }, (_, i) => ({
      index: activeIndex + i,
      bounds: { x: startX + i * slideW, y: 0, width: slideW, height: slideH },
      safeBounds: { x: startX + i * slideW + 40, y: 40, width: slideW - 80, height: slideH - 80 },
      isSpanningAllowed: true,
    })),
    seams,
    lockedZones: [],
  };
}
```

---

### Pattern 2: Binary Space Partitioning (BSP) Tree with Reactive Seam/Divider Model

**What:** Modeling layout slots as an immutable Binary Space Partitioning (BSP) Tree rather than isolated flat bounding boxes. An internal `SplitNode` divides an area horizontally or vertically according to a fractional `ratio` (e.g. 0.5 for equal split, 0.62 for hero/companion). Each split node exposes an interactive `Divider`. When the user drags a divider, only that node's `ratio` changes; its descendant leaf slots recalculate their bounds predictably while maintaining outer bounding constraints.

**When to use:** For dynamic multi-photo layouts where users expect interactive split adjustment (similar to modern tile window managers, Lightroom Book module, or SmartAlbums).

**Trade-offs:** 
- *Pros:* Mathematically guarantees frames never overlap and never breach safe margins. Dividers can be dragged with fluid 60fps performance without complex geometric collision detection.
- *Cons:* Arbitrary, freeform overlapping collages cannot be represented by pure BSP trees. 
- *Resolution:* If a user moves an element freely via standard Konva handles, the spread uncouples from the BSP tree into "Freeform Canvas" mode.

**Example:**
```typescript
// src/domain/layout/partitionTree.ts

export type PartitionOrientation = 'horizontal' | 'vertical';

export interface LayoutSlotNode {
  type: 'slot';
  id: string;
  elementId?: string; // Corresponds to PhotoFrameElement.id
  photoId?: string | null;
  bounds: RectBounds; // Computed absolute coordinates
  minDimension: number; // e.g. 80px or 30mm
}

export interface LayoutSplitNode {
  type: 'split';
  id: string;
  dividerId: string;
  orientation: PartitionOrientation;
  ratio: number; // 0.15 to 0.85 (clamped)
  spacing: number;
  leftChild: LayoutNode;
  rightChild: LayoutNode;
  bounds: RectBounds;
}

export type LayoutNode = LayoutSlotNode | LayoutSplitNode;

export interface LayoutPartitionTree {
  root: LayoutNode;
  containerBounds: RectBounds;
  spacing: number;
}

/**
 * Recomputes all absolute bounding boxes in the tree when a split ratio changes.
 */
export function evaluatePartitionTree(node: LayoutNode, bounds: RectBounds, spacing: number): LayoutNode {
  if (node.type === 'slot') {
    return { ...node, bounds: { ...bounds } };
  }

  const { orientation, ratio, leftChild, rightChild } = node;

  if (orientation === 'vertical') {
    const usableW = Math.max(0, bounds.width - spacing);
    const leftW = Math.round(usableW * ratio);
    const rightW = usableW - leftW;

    const leftBounds: RectBounds = { x: bounds.x, y: bounds.y, width: leftW, height: bounds.height };
    const rightBounds: RectBounds = { x: bounds.x + leftW + spacing, y: bounds.y, width: rightW, height: bounds.height };

    return {
      ...node,
      bounds: { ...bounds },
      leftChild: evaluatePartitionTree(leftChild, leftBounds, spacing),
      rightChild: evaluatePartitionTree(rightChild, rightBounds, spacing),
    };
  } else {
    const usableH = Math.max(0, bounds.height - spacing);
    const topH = Math.round(usableH * ratio);
    const botH = usableH - topH;

    const topBounds: RectBounds = { x: bounds.x, y: bounds.y, width: bounds.width, height: topH };
    const botBounds: RectBounds = { x: bounds.x, y: bounds.y + topH + spacing, width: bounds.width, height: botH };

    return {
      ...node,
      bounds: { ...bounds },
      leftChild: evaluatePartitionTree(leftChild, topBounds, spacing),
      rightChild: evaluatePartitionTree(rightChild, botBounds, spacing),
    };
  }
}
```

---

### Pattern 3: Background Worker Ingestion with Cooperative Time-Sliced Streaming

**What:** Moving all chronological clustering, pacing distribution, permutation partition searching, and bipartite photo matching into a dedicated Web Worker (`layoutEngine.worker.ts`). Results are streamed back to the main thread in progressive chunks (e.g., 3–5 spreads per message), allowing React to render progress increments and live previews without starving the UI event loop.

**When to use:** Whenever auto-flowing 10+ photos across multiple spreads/slides, or executing batch storytelling operations.

**Trade-offs:** Requires serializing input photo metadata across the Worker postMessage boundary. (Photo binary data is never passed; only lightweight metadata: aspect ratio, rating, timestamp, dimensions). Eliminates UI thread hangs completely.

**Example:**
```typescript
// src/workers/layoutEngine.worker.ts

self.onmessage = async (e: MessageEvent<AutoFlowRequestMessage>) => {
  const { photos, surfaceConfig, pacingRules } = e.data;

  // 1. Story Clustering by Timestamp & Event Bursts
  const clusters = clusterPhotosByTimeGaps(photos, pacingRules.timeGapMinutes);

  // 2. Budget Spreads based on Rhythm Rules
  const spreadBudgets = budgetPhotosToSpreads(clusters, pacingRules);
  const totalSpreads = spreadBudgets.length;

  // 3. Progressive Generation & Streaming
  for (let i = 0; i < totalSpreads; i++) {
    const budget = spreadBudgets[i];
    
    // Evaluate top 15 combinatorial partitions
    const bestVariation = findOptimalLayoutVariation(budget.photos, surfaceConfig);
    const generatedSpread = buildSpreadFromVariation(bestVariation, budget.photos, surfaceConfig);

    // Yield back to main thread progressively
    self.postMessage({
      type: 'AUTOTEXT_CHUNK_PROGRESS',
      completedSpreads: i + 1,
      totalSpreads,
      spread: generatedSpread,
    });
  }

  self.postMessage({ type: 'AUTOFLOW_COMPLETE' });
};
```

---

## Data Flow

### Request Flow

```
[User Drop 100 Photos / Click Auto-Flow]
    │
    ▼
[AutoFlowController] ──(Dispatches metadata)──► [layoutEngine.worker.ts]
    │                                                    │
    │                                                    ├─ Cluster by EXIF Time
    │                                                    ├─ Pacing & Page Budgeting
    │                                                    └─ Permutation Scoring & Mapping
    │                                                              │
    ◄───────(Progressive Chunks via postMessage)───────────────────┘
    │
    ▼
[Batch State Ingestion]
    │
    ├─ Updates albumStore.spreads / carouselStore.slides
    ├─ History checkpoint pushed to historyStore
    ▼
[Konva Canvas Layer] ──(Re-renders only active spread/slide via memoized layers)
```

### State Management

```
                 ┌────────────────────────────────┐
                 │       User Interaction         │
                 │ (Drag Divider / Pick Template) │
                 └───────────────┬────────────────┘
                                 │
                                 ▼
                 ┌────────────────────────────────┐
                 │          editorStore           │
                 │ - activeDraggingDividerId      │
                 │ - transientDividerPos          │
                 └───────────────┬────────────────┘
                                 │
                     (On Drag - 60fps Transient)
                                 │
                                 ▼
                 ┌────────────────────────────────┐
                 │       Konva Canvas Layer       │
                 │ - batchDraw() active nodes     │
                 │ - zero React re-render overhead│
                 └───────────────┬────────────────┘
                                 │
                      (On Mouse Up - Commit)
                                 │
                                 ▼
                 ┌────────────────────────────────┐
                 │   albumStore / carouselStore   │
                 │ - Updates Spread.elements      │
                 │ - Updates PartitionTree        │
                 │ - Pushes history undo frame    │
                 └────────────────────────────────┘
```

### Key Data Flows

1. **Interactive In-Canvas Divider Dragging:**
   - **Hover:** Pointer moves over a divider hit-area ($12\text{px}$ width). Konva switches stage cursor to `col-resize` or `row-resize` and illuminates the divider line.
   - **Drag Start:** `editorStore.startDividerDrag(dividerId, initialCoord)`. A transparent full-canvas Konva overlay captures pointer moves to prevent losing focus over nested frames.
   - **Drag Move:** Local delta updates the split node's ratio (clamped between $0.15$ and $0.85$ based on child min-dimensions). The Konva nodes update positions directly via direct ref/batchDraw for zero-lag $60\text{fps}$ visual feedback.
   - **Drag End (Commit):** The final ratio is applied to the active `Spread` or `CarouselSlide` elements in `albumStore` / `carouselStore`, and a single snapshot is recorded in `historyStore` for clean undo/redo.

2. **Auto-Flow Multi-Spread Ingestion:**
   - User drops a batch of $50–200$ photos onto the filmstrip or clicks "Auto-Flow Story".
   - `AutoFlowController` extracts photo metadata (`id`, `aspectRatio`, `dateTimeOriginal`, `rating`, `isFavorite`).
   - Metadata is sent to `layoutEngine.worker.ts`.
   - The worker groups photos into story clusters based on capture timestamp gaps (e.g. $> 10$ min delta creates a scene boundary).
   - For each cluster, the worker applies pacing rules:
     - 5-star / Hero photos $\to$ Full-bleed single page or panoramic spread.
     - Action sequences / Portraits $\to$ 3–4 photo balanced spreads.
     - Closing / Detail shots $\to$ 2 photo asymmetric spreads.
   - The worker emits `CHUNK_READY` events every $2$ spreads. The main thread progressively appends spreads to `albumStore` while presenting a non-modal progress pill, keeping the active editor fully responsive.

3. **Cross-Mode Template Sharing:**
   - A photographer creates a stunning 2-page print spread layout with an asymmetric 65/35 split and 3 sidebar frames.
   - The layout recipe is stored in the unified BSP format.
   - In Social Carousel mode, the user selects "2-Slide Panorama" $\to$ the engine reads the same recipe, normalizes the container to $2160 \times 1080\text{px}$, and instantly renders the identical visual composition spanning across slides 1 and 2.

---

## Scaling Considerations

| Scale Range | Architecture Adjustments |
|-------------|--------------------------|
| **1–10 Photos** *(Single Spread/Slide)* | Evaluated synchronously in main-thread memoized functions (`scoreAndSortVariations`) backed by LRU cache ($< 5\text{ms}$). |
| **10–50 Photos** *(Mini Carousel / Short Album)* | Multi-spread auto-flow scheduled via microtasks or single Web Worker task; completes in $< 50\text{ms}$. |
| **50–300 Photos** *(Full Wedding / Event Album)* | Full Web Worker pipeline mandatory. Chunked streaming ($5$ spreads per message). Main thread utilizes `requestAnimationFrame` to batch store updates without stalling canvas render. |
| **300+ Photos** *(Multi-Day Studio Ingestion)* | Worker offloads cluster bin-packing; photo thumbnail decodes throttled; virtualized spread filmstrip with Konva canvas viewport clipping. |

### Scaling Priorities

1. **First Bottleneck — UI Thread Freeze during Combinatorial Partition Search:**
   - *Problem:* Evaluating all permutations of $N$ photos across $K$ sub-boxes with bipartite assignment and crop penalty matrix calculations causes noticeable $200\text{ms}–800\text{ms}$ jank if run on the main UI thread.
   - *Fix:* Offload all permutation searching to `layoutEngine.worker.ts`. The UI thread only receives the winning top candidate for each spread.
2. **Second Bottleneck — Konva Canvas Layer Thrashing & Transformer Overhead:**
   - *Problem:* Re-rendering $50+$ photo frames simultaneously when dragging a divider causes Konva stage thrashing.
   - *Fix:* Separate frames into two sibling groups during drag: only recalculate and `batchDraw()` the 2 neighboring frame groups affected by the specific divider being manipulated. All other spread elements remain static in an unaffected Konva Group.
3. **Third Bottleneck — High-DPI Memory Footprint during Batch Generation:**
   - *Problem:* Generating 50 spreads must not trigger immediate high-res image decodes into GPU memory.
   - *Fix:* Auto-flow only assigns photo references (`photoId`, `filePath`, `thumbnailPath`). Images are lazily loaded by `ImageElement` only when a spread scrolls into the active editor viewport.

---

## Anti-Patterns

### Anti-Pattern 1: Running Combinatorial Layout Search on the React/Konva Main Thread

**What people do:** Calling `generateAdaptiveLayoutVariations()` in a `useMemo` or inside a batch photo placement loop directly on the main thread for 100+ photos.  
**Why it's wrong:** The Hungarian/bipartite assignment algorithm and crop penalty calculation for 50 spreads freeze React rendering and Konva RAF loops, triggering the macOS spinning beachball.  
**Do this instead:** Execute batch layout searches exclusively inside `layoutEngine.worker.ts` and stream results progressively back to `albumStore`.

### Anti-Pattern 2: Storing Dividers as Independent Freeform Bounding Boxes

**What people do:** Treating dividers as standard draggable canvas elements with arbitrary `{x, y}` coordinates in the spread elements array.  
**Why it's wrong:** Causes state desynchronization. If an element's size changes or margin updates, the divider coordinate drifts, creating disjointed gaps, overlapping frames, or broken layout constraints.  
**Do this instead:** Treat dividers as virtual projections of the underlying `LayoutSplitNode`. A divider has no independent coordinates—its position is strictly derived from `bounds.x + bounds.width * ratio`.

### Anti-Pattern 3: Imperative Konva Dragging Bypassing the State Store and History Stack

**What people do:** Directly modifying Konva node attributes during divider drag without syncing with Zustand, or conversely, pushing 60 undo actions per second into `historyStore` during mouse movement.  
**Why it's wrong:** Skipping Zustand breaks React component synchronization (e.g. dimension inspectors in the sidebar don't update). Pushing to history on every mouse move pollutes the undo stack, making "Undo" useless.  
**Do this instead:** Use a two-tiered state pattern:
1. *During drag:* Update transient state in `editorStore` and invoke Konva `batchDraw()` for 60fps responsiveness.
2. *On mouse up:* Atomically commit the updated spread geometry to `albumStore` / `carouselStore` and push exactly **one** snapshot to `historyStore`.

---

## Integration Points

### External Services & Native Boundaries

| Boundary | Integration Pattern | Notes & Safeguards |
|----------|---------------------|--------------------|
| **Tauri 2 Rust Backend** | IPC invoke commands (`get_exif_metadata`, `read_image_dimensions`) | Auto-flow queries EXIF timestamps and dimensions in batch Rust threads before passing metadata to the layout worker. |
| **Native macOS File System** | Local file URLs (`file://`) and sandboxed asset caching | Auto-flow preserves absolute file paths and relative project references; no raw image blobs are cloned into memory. |
| **Layered PSD / TIFF Export** | Rust export worker | Layout partitions generate exact sub-millimeter rect bounds that map directly to high-res 300 DPI PSD layer bounds. |

### Internal Boundaries

| Boundary | Communication Pattern | Notes |
|----------|-----------------------|-------|
| **`albumStore` / `carouselStore` ↔ `UnifiedLayoutEngine`** | Pure functional invocation via `adaptSpreadToSurfaceContext()` and `buildSpreadFromVariation()` | Stores remain source-of-truth; engine remains stateless and side-effect free. |
| **`KonvaEditorCanvas` ↔ `InteractiveDividersOverlay`** | Konva `<Layer>` composition with shared scaleFactor & stage position | Dividers listen to Konva pointer events, intercepting clicks before underlying photo frames receive selection events. |
| **Main UI Thread ↔ `layoutEngine.worker.ts`** | Typed Web Worker `postMessage` protocol | Messages carry serializable JSON; no complex class instances or circular references. |

---

## Sources

- OpenSmartAlbum codebase:
  - [`src/domain/adaptiveLayout.ts`](file:///Users/chiio/VSCode/albumaker/src/domain/adaptiveLayout.ts) — Combinatorial partitioning, LRU cache, and bipartite scoring.
  - [`src/domain/carouselLayout.ts`](file:///Users/chiio/VSCode/albumaker/src/domain/carouselLayout.ts) — Multi-slide presets, spanning panoramas, and slice offset logic.
  - [`src/stores/albumStore.ts`](file:///Users/chiio/VSCode/albumaker/src/stores/albumStore.ts) — Spread data structures, safe margins, and layout application.
  - [`src/stores/carouselStore.ts`](file:///Users/chiio/VSCode/albumaker/src/stores/carouselStore.ts) — Carousel state, ratio switching, and multi-slide photo placement.
  - [`src/features/editor/KonvaEditorCanvas.tsx`](file:///Users/chiio/VSCode/albumaker/src/features/editor/KonvaEditorCanvas.tsx) — Main Konva 2-layer rendering, selection transformer, and event handling.
  - [`src/features/carousel/CarouselCanvas.tsx`](file:///Users/chiio/VSCode/albumaker/src/features/carousel/CarouselCanvas.tsx) — Continuous multi-slide Konva canvas and slice boundary guides.
  - [`src/features/templates/TemplatesPanel.tsx`](file:///Users/chiio/VSCode/albumaker/src/features/templates/TemplatesPanel.tsx) — Template preview cards, windowed virtual rendering, and layout cycling.
- Industry reference architectures:
  - *Fundy Designer v10* — Dynamic layout grouping, automatic storytelling auto-flow, and split-line dragging.
  - *Pixellu SmartAlbums 2* — Intelligent aspect ratio matching, spine-safe margin collision avoidance, and multi-spread timeline clustering.
  - *Binary Space Partitioning (BSP) in 2D UI Layout Engines* — Knuth-Plass line breaking & BSP split trees for responsive photo tiling.

---
*Architecture research for: Milestone v1.2.0: Unlimited Studio Layout & Storytelling Engine in OpenSmartAlbum-MacOS*  
*Researched: 2026-09-23*  
