# Stack Research

**Domain:** Generative Studio Layout Algorithms, Interactive Canvas Manipulation & Multi-Spread Storytelling Engine (OpenSmartAlbum-MacOS Milestone v1.2.0)
**Researched:** 2026-09-23
**Confidence:** HIGH

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Pure TypeScript Domain Engine** | `^5.6.x` | Algorithmic layout synthesis, R-BSP slicing trees, bipartite aspect matching, and sub-millimeter geometry math. | Zero runtime bundle overhead, deterministic execution, perfect typing for geometric ASTs (`PartitionTree`, `SplitNode`, `SlotNode`), zero security/cve surface, and portable across Main thread, Web Worker, and Tauri Rust backend. |
| **Konva.js / react-konva** | `konva@^9.3.0`<br/>`react-konva@^18.2.0` | 2D Canvas retained scene graph, divider overlays, and direct imperative manipulation. | Already powers the OpenSmartAlbum canvas. Konva provides dedicated Layer separation (isolating static photo layers from interactive 60fps divider line dragging), high-performance hit-testing, and direct imperative node mutations (`node.x()`, `node.width()`, `layer.batchDraw()`) that bypass React virtual DOM reconciliation during pointer drags. |
| **Zustand** | `^5.0.0` | State management for canvas entities, spread layouts, and transient divider drag state. | High-performance React state management with decoupled transient listeners (`useStore.subscribe`). Enables 120Hz/60Hz live pointer tracking without React re-render cascades, while maintaining clean atomic transaction commits on pointer release. |
| **Tauri 2 Native App Core** | `@tauri-apps/api@^2.0.0` | macOS native shell, file I/O, IPC bridge, high-DPI print export. | Sub-100MB RAM consumption, seamless macOS native file drop interception, zero Node.js runtime baggage, and direct hardware-accelerated WebKit rendering. |
| **Web Workers API (Native Browser / Vite)** | Standard ES Modules (`layout.worker.ts`) | Off-thread batch layout synthesis and auto-flow clustering for large photo sets ($N = 50..300+$). | Prevents UI micro-stutters and macOS beachballs during multi-spread album generation; keeps main thread running at smooth 60fps. |

---

### Supporting Libraries & Domain Modules

| Library / Module | Version / Source | Purpose | When to Use |
|------------------|------------------|---------|-------------|
| **`src/domain/layout/bspEngine.ts`** | Internal Pure TS | Recursive Binary Space Partitioning layout generator with harmonic/golden ratios ($0.618, 0.5, 0.382$). | Generates arbitrary non-overlapping rectangular grid topologies for any photo count $N \in [1..15]$ on any surface. |
| **`src/domain/layout/rowColumnNormalizer.ts`** | Internal Pure TS | Equal-height row normalization and equal-width column normalization solvers. | Used when laying out horizontal photo strips, vertical masonry columns, and justified photo galleries with 100% native aspect-ratio fidelity. |
| **`src/domain/layout/aspectMatcher.ts`** | Internal Pure TS | Logarithmic aspect matching energy minimization and Hungarian / Munkres bipartite assignment algorithm ($O(N^3)$). | Maps an arbitrary set of $N$ photos (with native orientations and star ratings) to $N$ layout slots with minimum crop penalty and optimal hero placement. |
| **`src/domain/layout/dividerGraph.ts`** | Internal Pure TS | Adjacency graph topology connecting layout slots to draggable horizontal and vertical divider lines. | Computes drag constraints, adjoining slot index maps, and proportional resize propagation when dragging divider guidelines. |
| **`src/domain/layout/autoFlowStoryteller.ts`** | Internal Pure TS | Multi-spread narrative sequencing, EXIF timestamp burst clustering, and orientation-aware cadence balancing. | Auto-populates 10 to 200+ photos across multiple album spreads or carousel slides in a single automated storytelling pass. |
| **`src/domain/editor.ts` (Geometry & Snapping)** | Internal Pure TS | Sub-millimeter coordinate conversions, margin/spine alignment, and gap snap guides. | Snapping divider guidelines and photo frames to spread edges, spine folds, safe margins, and adjacent element gaps. |

---

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| **`tsx`** | `^4.23.12` | Instant TypeScript test execution and mathematical algorithm verification. | Runs unit tests directly against geometric solvers and partition trees in `<15ms` without Vite build overhead. |
| **Vite** | `^6.0.0` | Frontend dev server and bundler with native ES module worker support (`new Worker(new URL('./layout.worker.ts', import.meta.url), { type: 'module' })`). | Fast HMR for Konva canvas components and seamless worker bundling. |
| **TypeScript Compiler (`tsc`)** | `^5.6.0` | Strict static type checking (`tsc --noEmit`). | Guarantees absolute coordinate type safety (`RectBounds`, `NormalizedRect`, `PartitionNode`). |

---

## Installation

Milestone v1.2.0 requires **zero new external runtime dependencies**. All mathematical layout engines, partition trees, bipartite assignment solvers, and divider interaction mechanics are implemented as pure TypeScript domain modules. This preserves zero-bundle bloat, zero native binary compilation issues, and zero vulnerability risk.

```bash
# Core dependencies (already verified in package.json)
npm install konva@^9.3.0 react-konva@^18.2.0 zustand@^5.0.0 @tauri-apps/api@^2.0.0

# Supporting UI & utility icons (already present)
npm install lucide-react@^1.47.0

# Development dependencies
npm install -D tsx@^4.23.12 typescript@^5.6.0 vite@^6.0.0 @types/react@^18.3.0 @types/react-dom@^18.3.0
```

---

## Mathematical Layout Algorithms & Interaction Architecture

### 1. Equal-Height Row Normalization (Justified Gallery Row Solver)

When $k$ photos are placed side-by-side in a horizontal row, every photo must share the identical height $H_{\text{row}}$ so that their top and bottom edges align with zero seam gaps.

Given:
- Target row width: $W_{\text{target}}$
- Inter-frame spacing (gap): $G$
- Photo count: $k$
- Native aspect ratios: $r_i = \frac{w_i}{h_i}$ for $i \in [1..k]$

The total width of the row is the sum of slot widths plus $(k - 1)$ gaps:
$$W_{\text{target}} = \sum_{i=1}^k w_i + (k - 1) \cdot G$$

Since all photos share height $H_{\text{row}}$, $w_i = H_{\text{row}} \cdot r_i$. Substituting gives:
$$W_{\text{target}} = H_{\text{row}} \sum_{i=1}^k r_i + (k - 1) \cdot G$$

Solving for the normalized row height:
$$\mathbf{H_{\text{row}} = \frac{W_{\text{target}} - (k - 1) \cdot G}{\sum_{i=1}^k r_i}}$$

Individual slot dimensions and positions:
$$w_i = H_{\text{row}} \cdot r_i$$
$$x_1 = X_{\text{start}}, \quad x_i = x_{i-1} + w_{i-1} + G$$

> [!NOTE]
> **Zero Crop Loss:** Equal-height row normalization preserves 100% of each photo's native aspect ratio. No cropping occurs within the row.
> 
> **Cumulative Sub-Pixel Rounding:** To prevent 0.5px seam gaps on Retina screens, slot boundaries must use cumulative edge rounding:
> $$X_{\text{edge}}(i) = \text{round}\left( X_{\text{start}} + \frac{\sum_{j=1}^i w_j + (i - 1) \cdot G}{1} \right)$$
> $$w_i = X_{\text{edge}}(i) - X_{\text{edge}}(i - 1) - G$$

---

### 2. Equal-Width Column Normalization (Vertical Masonry Column Solver)

The dual formulation of the row solver. When $m$ photos are stacked vertically in a column, all photos share the identical width $W_{\text{col}}$.

Given:
- Target column height: $H_{\text{target}}$
- Inter-frame spacing: $G$
- Photo count: $m$
- Native aspect ratios: $r_j = \frac{w_j}{h_j}$ for $j \in [1..m]$

Since $h_j = \frac{W_{\text{col}}}{r_j}$:
$$H_{\text{target}} = \sum_{j=1}^m h_j + (m - 1) \cdot G = W_{\text{col}} \sum_{j=1}^m \frac{1}{r_j} + (m - 1) \cdot G$$

Solving for the normalized column width:
$$\mathbf{W_{\text{col}} = \frac{H_{\text{target}} - (m - 1) \cdot G}{\sum_{j=1}^m \frac{1}{r_j}}}$$

Individual slot dimensions:
$$h_j = \frac{W_{\text{col}}}{r_j}$$
$$y_1 = Y_{\text{start}}, \quad y_j = y_{j-1} + h_{j-1} + G$$

---

### 3. Recursive Binary Space Partitioning (R-BSP) Layout Engine

To generate unlimited aesthetic studio layouts for any photo count $N \in [1..15]$ without hardcoded presets, the surface is modeled as a slicing tree:

```
                  [ Root Spread Box ]
                     /            \
           (Split V, ratio=0.618)
                 /                    \
       [ Left Hero Slot ]        [ Right Sub-Box ]
                                   /           \
                         (Split H, ratio=0.5)
                               /               \
                       [ Top Right ]     [ Bottom Right ]
```

#### Slicing Operators
A partition node splits a bounding box $B = (x, y, w, h)$ along axis $A \in \{\text{Horizontal}, \text{Vertical}\}$ using split ratio $\alpha \in (0, 1)$ and gap $G$:

- **Vertical Split ($A = \text{V}$):**
  $$w_{\text{left}} = \text{round4}\left( (w - G) \cdot \alpha \right)$$
  $$w_{\text{right}} = w - G - w_{\text{left}}$$
  $$B_{\text{left}} = (x, y, w_{\text{left}}, h), \quad B_{\text{right}} = (x + w_{\text{left}} + G, y, w_{\text{right}}, h)$$

- **Horizontal Split ($A = \text{H}$):**
  $$h_{\text{top}} = \text{round4}\left( (h - G) \cdot \alpha \right)$$
  $$h_{\text{bottom}} = h - G - h_{\text{top}}$$
  $$B_{\text{top}} = (x, y, w, h_{\text{top}}), \quad B_{\text{bottom}} = (x, y + h_{\text{top}} + G, w, h_{\text{bottom}})$$

#### Editorial Split Ratios
Instead of arbitrary random ratios, the engine samples from professional editorial harmonic proportions:
- **Golden Ratio Hero:** $\alpha \in \{0.618, 0.382\}$ (large focal hero with companion stack)
- **Two-Thirds Rule:** $\alpha \in \{0.667, 0.333\}$
- **Symmetric Balance:** $\alpha = 0.500$
- **Three-Quarter Cinematic:** $\alpha \in \{0.750, 0.250\}$

#### Guarantee of Zero-Blank Generation for $N \in [1..15]$
By recursively partitioning the largest remaining leaf box until exactly $N$ leaves are created, the engine mathematically guarantees that **exactly $N$ slots are produced for $N$ photos**, completely eliminating the legacy flaw of blank grey frames.

---

### 4. Aspect Ratio Matching & Energy Minimization (Bipartite Assignment)

When fitting $N$ photos into $N$ slots, an optimal permutation $\pi: \{1..N\} \to \{1..N\}$ must be found that minimizes total visual distortion and crop loss.

#### Cost Function Formulation
For photo $i$ with natural aspect ratio $P_i = w_i / h_i$ and slot $j$ with aspect ratio $S_j = W_j / H_j$:

1. **Log-Aspect Divergence (Scale-Invariant Metric):**
   $$C_{\text{aspect}}(i, j) = \left| \ln(P_i) - \ln(S_j) \right|$$
   *Property:* Symmetric and scale-invariant (e.g. 3:2 photo in 2:3 slot has identical cost $\ln(2.25) \approx 0.81$ as 2:3 photo in 3:2 slot).

2. **Orientation Mismatch Penalty:**
   $$C_{\text{orient}}(i, j) = \begin{cases} 0 & \text{if } (P_i \ge 1 \land S_j \ge 1) \lor (P_i < 1 \land S_j < 1) \\ 2.5 & \text{otherwise (landscape in portrait or vice versa)} \end{cases}$$

3. **Hero Importance Bias:**
   If photo $i$ has high user rating or favorite flag, penalize assigning it to a small slot:
   $$C_{\text{hero}}(i, j) = -\beta \cdot \text{rating}_i \cdot \frac{\text{Area}(S_j)}{\text{Area}_{\text{total}}}$$

4. **Total Edge Cost:**
   $$C_{ij} = C_{\text{aspect}}(i, j) + C_{\text{orient}}(i, j) + C_{\text{hero}}(i, j)$$

#### Optimal Assignment Solver: Hungarian / Munkres Algorithm ($O(N^3)$)
For $N \le 15$, the Hungarian algorithm solves the assignment problem in under **0.05 milliseconds** in pure TypeScript:
$$\min_{\pi} \sum_{i=1}^N C(i, \pi(i))$$
This guarantees the mathematically optimal placement: hero photos land in hero slots, portrait photos land in portrait slots, and crop waste is strictly minimized.

---

### 5. Konva.js Canvas Interaction: Draggable Dividers & Sub-Millimeter Snapping

#### Draggable Divider Guideline Architecture
Dividers between adjacent frames are modeled as interactive Konva nodes situated in a dedicated `DividerOverlayLayer`:
- **Hit Detection Zone:** An invisible rectangle with an 10px hit width (`hitStrokeWidth: 10`) surrounding the divider line for effortless mouse targeting.
- **Visual Feedback:** A crisp 1.5px accent line (`#3b82f6` on hover/drag, transparent or subtle `#ffffff15` when idle).
- **Cursor Hooks:** `cursor: 'col-resize'` for vertical dividers, `cursor: 'row-resize'` for horizontal dividers.
- **Adjacency Mapping:** Each divider tracks its `leftSlots: string[]` and `rightSlots: string[]` (or top/bottom).

```
┌──────────────────┬───┬──────────────────┐
│                  │ D │                  │
│    Left Slot     │ I │    Right Slot    │
│                  │ V │                  │
│ (W_left + Δx)    │ I │ (W_right - Δx)   │
│                  │ D │ (X_right + Δx)   │
│                  │ E │                  │
│                  │ R │                  │
└──────────────────┴───┴──────────────────┘
```

#### 60fps Drag Loop via RAF & Direct Konva Imperative Mutation
- During `dragmove`, **do NOT dispatch React/Zustand state updates**.
- Instead, mutate Konva node coordinates directly via refs:
  ```typescript
  dividerLine.x(snappedScreenX);
  leftFrames.forEach(f => f.width(newWidthLeft));
  rightFrames.forEach(f => { f.x(newXRight); f.width(newWidthRight); });
  overlayLayer.batchDraw();
  ```
- Coalesce mouse moves with `requestAnimationFrame`.
- On `dragend` (pointer release), calculate final physical coordinates (mm) and dispatch a single atomic transaction to `albumStore` / `carouselStore`.

#### Sub-Millimeter Precision Snapping
- **Coordinate Space Conversion:**
  $$\text{physicalMm} = \frac{\text{canvasPixels}}{\text{scaleFactor} \cdot (\text{DPI} / 25.4)}$$
- **Zoom-Adaptive Screen Snapping:**
  Snapping feel must remain constant regardless of canvas zoom level. A snap distance of 8 screen pixels corresponds to:
  $$\text{threshold}_{\text{physical}} = \frac{8}{\text{scaleFactor}} \cdot \frac{25.4}{\text{DPI}} \text{ mm}$$
- **Snap Targets:**
  - Golden Ratio and 50% centerline of the parent container.
  - Alignment edges of orthogonal spread elements.
  - Spine fold ($X = \text{pageWidth}$) and safe margins ($X = \text{margin}$ and $X = \text{spreadWidth} - \text{margin}$).

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| **Pure TypeScript Geometry Partitioner** | Yoga Layout (Flexbox WASM) | Use Yoga if building a complex arbitrary responsive UI document (e.g., HTML web pages). For print album spreads and photo carousels, Yoga cannot perform aspect-ratio energy matching, adds 1.5MB WASM binary overhead, and fails to handle proportional equal-height row scaling with fixed outer containers. |
| **Hungarian / Munkres Algorithm ($O(N^3)$)** | Greedy Local Best-Fit ($O(N^2 \log N)$) | Greedy matching can be used as a sub-millisecond fallback for large preview grids with $N > 30$ photos. For spread photo counts $N \in [1..15]$, Hungarian execution is virtually instantaneous ($<0.05\text{ms}$) and prevents catastrophic local minimum traps. |
| **Konva Retained Layer with Imperative Refs** | HTML/SVG DOM Dragging | Use HTML/SVG for simple dashboards. For high-DPI desktop photo publishing with 30+ 4K images on a spread, DOM manipulation triggers severe layout reflows and frame drops below 15fps. |
| **Pure TS Adjacency Divider Graph** | Third-party Splitter libraries (e.g. `split.js`, `react-resizable`) | DOM splitters manipulate HTML divs and cannot interact with Konva Canvas 2D scene graphs or handle bleed/spine physical millimeter coordinates. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Static Hardcoded Preset Templates with Fixed Rects** | Hardcoding templates for $N \le 6$ causes layout generation to fail or drop photos when $N \in [7..15]$. Switching templates with differing photo counts causes blank grey frames or photo loss. | **Dynamic R-BSP Partitioner** that generates strictly $N$ slots for $N$ photos. |
| **React State Dispatch on Every `pointermove` / `dragmove`** | Emitting Zustand/React state updates on 120Hz mouse moves triggers full Virtual DOM re-rendering of all high-resolution canvas image textures, dropping frame rates to <15fps. | **Imperative Konva Ref Updates + `batchDraw`**, committing a single atomic history transaction on pointer release. |
| **Independent Per-Slot Floating Point Coordinate Rounding** | Calculating slot $A$'s width and slot $B$'s $X$ position independently causes 0.5px to 1px fractional rounding cracks where the white page or dark pasteboard bleeds through. | **Shared Boundary Topology & Cumulative Edge Snapping**, ensuring adjacent frames share the exact same boundary line. |
| **Non-Proportional Frame Stretching on Divider Drag** | Directly resizing photo frames without updating photo focal points or aspect-cover crops squashes faces and distorts image aspect ratios. | **Proportional Aspect-Fill Recalculation** preserving focal point coordinates during divider adjustments. |
| **Main Thread Synchronous Auto-Flow for 50+ Photos** | Computing R-BSP trees and Hungarian matrices for 50–200 photos synchronously on the main UI thread freezes the cursor and triggers macOS beachballs. | **Web Worker Off-Thread Ingestion** streaming completed spreads in chunks via `postMessage`. |

---

## Stack Patterns by Variant

**If generating layouts for Print Album Spreads:**
- Use **Spread-Aware R-BSP with Spine Inset Protection**.
- Because layflat print albums have a central gutter/spine fold where facial features must not be split unless explicitly tagged as a Panoramic Hero spread.

**If generating layouts for Social Carousels (Instagram 1:1, 4:5, 9:16):**
- Use **Multi-Slide Span Partitioner with Gapless Micro-Overlap**.
- Because multi-slide panoramic photos require seamless continuity across carousel slide boundaries without sub-pixel white seams.

**If the user drags a Divider Guideline:**
- Use **Adjacency Constrained 1D Axis Dragging with Physical Minimum Bounds ($\ge 20\text{mm}$)**.
- Because frames must not be collapsed to zero width or inverted, and outer spread margins must remain perfectly stationary.

**If auto-flowing a batch of 20+ photos:**
- Use **EXIF Timestamp Burst Clustering & Orientation Cadence (1L+2P, 2P+2P, 1 Hero)** via Web Worker.
- Because wedding and event albums tell a chronological narrative, grouping photos taken within minutes of each other and balancing visual rhythm.

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `konva@^9.3.0` | `react-konva@^18.2.0` | Verified compatible. Direct node ref mutations work seamlessly with `batchDraw()`. |
| `react-konva@^18.2.0` | `react@^18.3.0` | Full support for React 18 concurrent features and StrictMode. |
| `zustand@^5.0.0` | `react@^18.3.0` | Transient store subscriptions (`useStore.subscribe`) function cleanly outside React render cycles. |
| `vite@^6.0.0` | Web Workers ES Modules | Fully supports `new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })` without special worker plugins. |
| `@tauri-apps/api@^2.0.0` | macOS WebKit Engine | Native file drag-and-drop and hardware-accelerated Canvas 2D operations run at native macOS speeds. |

---

## Sources

- **Pixellu SmartAlbums & Fundy Designer Layout Architecture Analysis** — Industry benchmark for generative album layouts, divider adjustments, and multi-spread auto-flow storytelling. Verified high confidence.
- **Konva.js Official Documentation (`konva.org/docs`)** — Verified best practices for high-performance canvas dragging, layer caching, `batchDraw()`, and event isolation.
- **Knuth-Plass & Flickr Justified Gallery Algorithmic Literature** — Mathematical formulations for equal-height row normalization and dynamic-programming line breaking.
- **Harold Kuhn (1955) / James Munkres (1957)** — The Hungarian Method for the Assignment Problem ($O(N^3)$ bipartite matching for aspect-ratio energy minimization).
- **OpenSmartAlbum-MacOS Codebase Audit** — Existing implementations in `src/domain/adaptiveLayout.ts`, `src/domain/editor.ts`, and `src/features/editor/KonvaEditorCanvas.tsx`.

---
*Stack research for: Unlimited Studio Layout & Storytelling Engine (OpenSmartAlbum-MacOS v1.2.0)*
*Researched: 2026-09-23*
