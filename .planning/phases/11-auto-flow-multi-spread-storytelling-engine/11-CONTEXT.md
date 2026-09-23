# Phase 11: Auto-Flow Multi-Spread Storytelling Engine - Context

**Gathered:** 2026-09-23
**Status:** Ready for planning
**Mode:** Autonomous smart-discuss (grounded in STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md)

<domain>
## Phase Boundary

Ingest 10–50+ photos in a single batch, automatically cluster them into narrative chapters using EXIF timestamp bursts, and flow them across sequential spreads (Print Album) or slides (Social Carousel) with balanced visual cadence and atomic undo.

Covers Requirements:
- `FLOW-01`: Dropping 10–50+ photos automatically groups and flows them across sequential spreads (Print Album) or slides (Social Carousel).
- `FLOW-02`: Photos are clustered into chronological narrative chapters using EXIF timestamp bursts (>5 min, >30 min gaps).
- `FLOW-03`: Narrative pacing heuristics balance visual cadence across spreads (mixing hero breathing moments with detailed multi-photo grids).
- `FLOW-04`: Heavy combinatorial layout calculations run off-the-main-thread via Web Worker (`layoutEngine.worker.ts`) or asynchronous chunking with progress streaming to prevent UI freezes.
- `FLOW-05`: Multi-spread auto-flow mutations are wrapped in an atomic history transaction (`executeHistoryTransaction`) so the entire flow can be undone with a single `Cmd+Z`.

</domain>

<decisions>
## Implementation Decisions

1. **Chronological Burst & Temporal Clustering (`src/domain/storytelling/temporalClusterer.ts`):**
   - Extract EXIF `dateTaken` or file modification timestamps from photos.
   - Segment photos into narrative clusters using adaptive thresholding:
     - Hard chapter boundary: time gap $\Delta t > 30\text{ minutes}$.
     - Soft scene boundary: time gap $\Delta t > 5\text{ minutes}$.
     - Max cluster size: 6 photos per spread/slide (optimal for wedding/editorial spreads).
     - Min cluster size: 1 photo (hero moment).

2. **Visual Rhythm & Narrative Cadence Engine (`src/domain/storytelling/cadenceEngine.ts`):**
   - Heuristic cadence distribution alternating between:
     - **Hero Breath:** 1-photo full spread or 1-photo dominant hero with margin.
     - **Dynamic Pair/Trio:** 2–3 photos with high harmony aspect matching.
     - **Detail Grid:** 4–6 photos capturing rapid ceremony/reception sequences.
   - Pacing scoring: avoids monotone repetition (e.g. preventing three 4-photo spreads in a row).

3. **Multi-Spread Auto-Flow Orchestrator (`src/domain/storytelling/autoFlowEngine.ts`):**
   - Given an array of photos, computes optimal spread clustering.
   - For each cluster, invokes `generateDynamicVariations` from `src/domain/layout/generator.ts`.
   - Selects top-scoring layout variation for each spread.
   - Supports both Print Album Spreads and Social Carousel Slides.

4. **Off-Thread / Non-Blocking Worker Pipeline (`src/domain/storytelling/layoutWorker.ts`):**
   - Performs cluster calculation and bipartite layout generation asynchronously with progress callback (`onProgress(percent, currentSpread)`).
   - In Vite / Tauri, provides a clean worker fallback if Web Worker environment is restricted, ensuring 100% testability in Node/tsx.

5. **Atomic Undo Transaction in `historyStore.ts` & `albumStore.ts` / `carouselStore.ts`:**
   - When auto-flowing across multiple spreads/slides, push exactly ONE snapshot to `historyStore` before applying changes.
   - Single `Cmd+Z` restores the entire previous album or carousel state instantaneously.

</decisions>

<code_context>
## Existing Code Insights

- `src/domain/layout/generator.ts`: The pure TS generative layout facade completed in Phase 10.
- `src/stores/albumStore.ts`: Spread management, `currentAlbum`, `activeSpreadId`.
- `src/stores/carouselStore.ts`: Slide management, `currentCarousel`, `addSlide`.
- `src/stores/historyStore.ts`: `pushState(album)` for undo/redo history.
- `src/features/workspace/WorkspaceLayout.tsx`: External Finder drop listener where multi-photo drops occur.

</code_context>
