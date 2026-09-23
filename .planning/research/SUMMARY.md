# Project Research Summary

**Project:** OpenSmartAlbum-MacOS
**Milestone:** v1.2.0: Unlimited Studio Layout & Storytelling Engine
**Domain:** Computational Geometry, Photographic Layouting, Multi-Spread Storytelling & Canvas Interaction
**Researched:** 2026-09-23
**Confidence:** HIGH

---

## Executive Summary

Milestone v1.2.0 elevates OpenSmartAlbum from a rigid, 12-preset layout selector into an intelligent, generative studio layout and storytelling powerhouse modeled after industry-leading professional wedding/event software (Pixellu SmartAlbums, Fundy Designer v10/v11, AlbumStomp) and modern social carousel platforms.

The current system suffered from critical layout defects: switching presets discarded excess photos, leaving phantom blank frames (`filePath: ''`), and locked users into rigid static arrangements. Furthermore, multi-slide social carousels and multi-spread albums lacked automated narrative pacing and cohesive batch ingestion.

Our 4-dimension research establishes the foundation for this transformation:
1. **Mathematical Core:** Dynamic Recursive Binary Space Partitioning (R-BSP), Equal-Height Row Normalization, and Equal-Width Column Normalization deliver infinite aspect-preserving layouts for any $N \in [1..15]$ photos without gaps or distortion.
2. **Storytelling Engine:** Batch ingestion with EXIF timestamp burst clustering and visual orientation cadence (e.g. 1L+2P, 2P+2P, Panorama Hero) to automatically flow 10–50+ photos across multiple spreads and slides.
3. **Interactive Studio Controls:** In-canvas divider line dragging at 60fps via imperative Konva refs and contextual right-click actions (`Set as Full Bleed Spread`, `Set as Seamless Panorama Span`, `Set as Hero`).
4. **Safety & Zero-Loss Guarantees:** Strict enforcement of the non-destructive photo pool invariant, whole-integer sub-pixel snapping, and atomic multi-spread history transactions.

---

## Key Findings

### Recommended Stack ([STACK.md](file:///Users/chiio/VSCode/albumaker/.planning/research/STACK.md))
- **Zero-Dependency TypeScript Geometry Engine:** Pure mathematical algorithms (`bspEngine.ts`, `rowColumnNormalizer.ts`, `aspectMatcher.ts`) executing identically across Main Thread, Web Worker, and Tauri Rust IPC.
- **Konva Retained Graph Optimization:** Two-tier canvas architecture separating static background, photo clipping groups, and high-frequency interaction divider guides.
- **Web Worker Background Pipeline (`layoutEngine.worker.ts`):** Offloads multi-spread combinatorial optimization and photo assignment for 30–50+ photo batches to ensure uninterrupted 60fps UI responsiveness.

### Expected Features ([FEATURES.md](file:///Users/chiio/VSCode/albumaker/.planning/research/FEATURES.md))
- **Table Stakes:**
  - Non-destructive $N$-photo layout cycling (`Spacebar` / `Shift+Space`).
  - Zero blank frames / no empty placeholders.
  - Proportional aspect-fill cover fit with normalized focal anchor caching.
  - Gutter and safe spine exclusion zone enforcement.
- **Differentiators:**
  - Auto-Flow Multi-Spread/Slide Storytelling Engine (chronological burst grouping + visual rhythm).
  - Contextual Right-Click Studio Actions (`Set as Full Bleed Spread`, `Set as Panorama Span`, `Set as Hero`).
  - Interactive In-Canvas Divider Dragging with Fundy-style fluid boundary recalculation.
  - Direct canvas drag-and-drop photo swapping.

### Architecture Approach ([ARCHITECTURE.md](file:///Users/chiio/VSCode/albumaker/.planning/research/ARCHITECTURE.md))
- **Unified `LayoutSurfaceContext`:** Abstract surface model bridging physical print sheets (mm, spine gutter, safe bleed) and digital carousels (px, multi-slide strip, seamless cut lines).
- **Hierarchical `LayoutPartitionTree`:** Tree structure of `LayoutSplitNode` and `LayoutSlotNode` driving both layout synthesis and responsive divider dragging.
- **Atomic History Transactions:** `executeHistoryTransaction()` encapsulating multi-spread/slide batch mutations into single undo/redo snapshots.

### Critical Pitfalls ([PITFALLS.md](file:///Users/chiio/VSCode/albumaker/.planning/research/PITFALLS.md))
1. **Sub-Pixel Rounding Seams:** Prevented via cumulative discrete edge allocation ($\text{Edge}(i) = \text{round}(i \times W / N)$) and micro-overlap overdraw in zero-gap mode.
2. **Aspect Ratio Distortion:** Prevented via container-clipping architecture, uniform aspect-fill cover, and normalized focal coordinates $(\text{normPanX}, \text{normPanY})$.
3. **Konva Drag Performance Lag:** Prevented by avoiding React/Zustand state dispatches during 120Hz pointer moves; imperative Konva node manipulation with RAF coalescing.
4. **Auto-Flow History Bloat:** Prevented by wrapping batch spread creation in atomic transaction envelopes.

---

## Implications for Roadmap

The research dictates a phased progression from mathematical foundations to studio interactivity and automated storytelling:

### Phase 10: Dynamic Generative Layout Core & Non-Destructive Studio Cycling
- **Rationale:** Solves the active defects shown in the user screenshots (lost photos, blank frames, rigid presets). Establishes the pure TS partitioner and aspect-matching engine.
- **Delivers:** Zero-blank generative layout generator for $N \in [1..15]$ photos; unified `Spacebar` / `Shift+Space` layout cycling; aspect-fill cover preservation across both Album and Carousel modes.
- **Avoids:** Photo loss, phantom black boxes, and rigid 12-preset limitation.

### Phase 11: Auto-Flow Multi-Spread Storytelling Engine
- **Rationale:** Depends on the Phase 10 generative core to instantiate spreads. Solves multi-photo batch ingestion across print spreads and carousel slides.
- **Delivers:** EXIF timestamp clustering, narrative pacing heuristics, batch drop ingestion, and off-thread Web Worker streaming.
- **Avoids:** Main thread UI freeze and chaotic photo sequencing.

### Phase 12: Contextual Right-Click Studio Actions & Panorama Span Engine
- **Rationale:** Builds upon the dynamic layout model by allowing users to override specific photo prominence.
- **Delivers:** Context menu (`Set as Full Bleed Spread`, `Set as Panorama Span`, `Set as Hero`), automatic rebalancing of residual photos, and split-line visual indicators.
- **Avoids:** Photo distortion on multi-slide spans and spine collision on print albums.

### Phase 13: Interactive In-Canvas Divider Dragging & Direct Photo Swapping
- **Rationale:** Requires stable geometry trees from Phase 10/12 to permit real-time split ratio modification.
- **Delivers:** Draggable divider guides on Konva canvas at 60fps; direct photo drag-and-drop swapping; atomic history commit on mouse up.
- **Avoids:** Canvas frame drop, aspect stretching during drag, and undo history fragmentation.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Pure TypeScript domain mathematical algorithms with Konva.js retained graph. Zero heavy external dependencies needed. |
| Features | HIGH | Thoroughly benchmarked against Pixellu SmartAlbums, Fundy Designer v11, and AlbumStomp. Clear table stakes and differentiators. |
| Architecture | HIGH | Unified `LayoutSurfaceContext` cleanly decouples Album vs Carousel modes while sharing layout algorithms. |
| Pitfalls | HIGH | Deep technical investigation into sub-pixel anti-aliasing, RAF throttling, and undo transaction models. |

**Overall Confidence:** HIGH

---

*Research completed: 2026-09-23*  
*Ready for roadmap: Yes*
