# Stack Research

**Domain:** Generative Layout Algorithms, Canvas Interaction & Performance for Professional Photo Album / Social Carousel Engine
**Researched:** 2026-09-23
**Confidence:** HIGH

## Executive Summary

Milestone v1.2.0 ("Unlimited Studio Layout & Storytelling Engine") replaces legacy rigid 12-preset template generators with a pure TypeScript generative geometric layout partitioner, aspect-aware bipartite matching engine, and Konva 60fps divider interaction model.

Rather than introducing bulky external layout engines (such as Yoga/Flexbox WASM or Packery), the studio layout requirements of professional wedding/event photo album design (Pixellu SmartAlbums, Fundy Designer, AlbumStomp) and multi-slide social carousels require deterministic, aspect-preserving mathematical models with zero dependencies:
1. **Equal-Height Row Normalization & Equal-Width Column Normalization** for horizontal/vertical photo strips.
2. **Recursive Binary Space Partitioning (R-BSP)** with editorial split ratios (Golden ratio $0.618$, $0.667$, $0.5$) for dynamic grid subdivisions.
3. **Munkres / Greedy Bipartite Aspect-Matching Energy Minimization** to guarantee minimal crop loss between photo aspect and slot aspect.
4. **Konva Direct Imperative Event Pipeline** (`batchDraw`, RAF coalescing, overlay layer isolation) for live 60fps divider dragging.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **TypeScript (Zero-Dep Domain Engine)** | `^5.6.x` | Pure Mathematical Layout Partitioning & Bipartite Solver | High-performance, zero overhead, perfectly typed data structures (`LayoutPartitionTree`, `LayoutSplitNode`, `LayoutSlotNode`). Runs identically in Main thread, Web Worker, or Tauri Rust IPC. |
| **Konva.js / react-konva** | `^9.3.x` | 2D Canvas Retained Mode Graph | Already core to OpenSmartAlbum. Excellent node ref access for imperative 60fps divider line manipulation and hit testing without triggering React component re-renders. |
| **Zustand** | `^5.0.x` | State Management & Transient Drag Stores | Lightweight, un-opinionated store. Allows transient state subscriptions for drag offsets (`editorStore.activeDividerOffset`) while isolating persistent document commits in `albumStore` / `carouselStore`. |
| **Tauri 2 Native App Core** | `^2.1.x` | macOS Native Desktop Shell | Low memory footprint (<100MB RAM), native file drag-and-drop ingestion, fast async disk I/O, and native window event hooks. |

### Supporting Libraries & Internal Domain Modules

| Module / Tool | Purpose | When to Use |
|---------------|---------|-------------|
| **`src/domain/layout/bspEngine.ts`** | Recursive Binary Space Partitioning generator | Evaluates permutations of vertical and horizontal cuts for $N \in [1..15]$ photos on any arbitrary rectangular surface. |
| **`src/domain/layout/rowColumnNormalizer.ts`** | Equal-height row and equal-width column solvers | Generates balanced multi-photo strips and clean masonry compositions without stretching or seam gaps. |
| **`src/domain/layout/aspectMatcher.ts`** | Aspect-matching energy minimization ($E = \sum |\log(r_{\text{slot}} / r_{\text{photo}})|$) | Assigns $N$ photos to $N$ generated slots with minimum crop penalty. |
| **`src/domain/layout/autoFlowStoryteller.ts`** | Narrative batch auto-flow engine | Clusters 10–50+ imported photos by EXIF timestamp burst & orientation cadence (1L+2P, 2P+2P, 1 Panorama Hero) into multi-spread sequences. |
| **`Web Worker` (`layoutEngine.worker.ts`)** | Off-thread layout synthesis for large auto-flow batches | When auto-flowing 20–50+ spreads/slides simultaneously, prevents main thread UI micro-stutters. |

---

## Mathematical Formulation of Algorithms

### 1. Equal-Height Row Normalization
For $k$ photos in a row with aspect ratios $r_1, r_2, \dots, r_k$ inside container width $W$ with spacing $G$:
$$H_{\text{row}} = \frac{W - (k - 1) \cdot G}{\sum_{i=1}^k r_i}$$
$$W_i = H_{\text{row}} \cdot r_i, \quad X_i = X_{\text{start}} + \sum_{j=1}^{i-1} (W_j + G)$$
*Result:* Every photo in the row shares the exact same height $H_{\text{row}}$, preserves 100% of its native aspect ratio $r_i$, and spans width $W$ with zero sub-pixel distortion.

### 2. Equal-Width Column Normalization
For $m$ photos in a column with aspect ratios $r_1, r_2, \dots, r_m$ inside container height $H$ with spacing $G$:
$$W_{\text{col}} = \frac{H - (m - 1) \cdot G}{\sum_{i=1}^m \frac{1}{r_i}}$$
$$H_i = \frac{W_{\text{col}}}{r_i}, \quad Y_i = Y_{\text{start}} + \sum_{j=1}^{i-1} (H_j + G)$$
*Result:* Every photo in the column shares width $W_{\text{col}}$, preserves native aspect ratio, and spans height $H$ seamlessly.

### 3. Aspect Ratio Matching Energy Minimization
Given slot aspect ratio $r_{\text{slot}} = W_{\text{slot}} / H_{\text{slot}}$ and photo natural aspect ratio $r_{\text{photo}} = W_{\text{photo}} / H_{\text{photo}}$:
$$\text{Cost}(i, j) = \left| \ln\left(\frac{r_{\text{slot}, i}}{r_{\text{photo}, j}}\right) \right|$$
Total layout energy:
$$E = \sum_{i=1}^N \text{Cost}(i, \pi(i))$$
Where $\pi$ is the permutation assigning photos to slots. The engine minimizes $E$ using greedy/optimal bipartite matching, guaranteeing that landscape photos map to landscape slots and portrait photos map to portrait slots.

---

## Alternatives Considered

| Recommended | Alternative | Why Rejected / When to Use Alternative |
|-------------|-------------|----------------------------------------|
| **Pure TypeScript Geometry Partitioner** | Yoga Layout (Flexbox WASM) | Yoga is built for UI flow, not aspect-preserving photo album design. It requires WASM binary overhead (~1.5MB), cannot perform aspect energy minimization, and struggles with equal-height proportional row scaling. |
| **Pure TS Bipartite Aspect Solver** | Packery / Masonry.js | Packery is DOM-based, unsuited for Konva canvas coordinate math, and produces non-deterministic bin-packing with whitespace holes. |
| **Konva Direct Node Mutation for Dragging** | React State Dispatch on `mousemove` | Dispatching Zustand/React state on 120Hz pointer moves triggers full virtual DOM reconciliation and re-rendering of all high-res canvas images, dropping FPS to <20fps. Imperative Konva ref mutation maintains solid 60fps. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Static Hardcoded Preset Arrays with Fixed Slot Counts** | Causes photo loss when cycling between presets of different slot counts and produces blank empty frames (`filePath: ''`). | **Dynamic Generative Partitioner** generating strictly $N$ slots for $N$ photos. |
| **Non-Proportional Direct Frame Resizing** | Causes photo stretching or severe crop disfiguring during divider dragging. | **Container-Clipping Architecture** with Proportional Aspect-Fill Cover and normalized focal point preservation. |
| **Main Thread Batch Permutation Calculation for >30 Photos** | Blocks UI thread during multi-spread auto-flow, freezing cursor and triggering macOS beachball. | **Chunked Web Worker Pipeline** streaming layout batches via `postMessage`. |
| **Un-batched History Mutations** | Pushes 20+ undo entries for a single auto-flow action, breaking Cmd+Z user expectations. | **Atomic Transaction Wrapper** (`executeHistoryTransaction`) committing the entire batch as 1 undo step. |

---

## Version Compatibility & Integration

- **Konva 9.3.x & react-konva:** Fully compatible with custom Canvas 2D shape drawing (`clipFunc`, `Konva.Path`, `Konva.Line`, and multi-layer rendering).
- **Zustand 5.x:** Supports transient listener subscriptions (`useStore.subscribe`) outside React lifecycle for divider dragging.
- **Tauri 2:** Provides native drag-and-drop events and native file access without IPC bottlenecks.

---
*Stack research for: Unlimited Studio Layout & Storytelling Engine (v1.2.0)*
*Researched: 2026-09-23*
