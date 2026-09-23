# Phase 11: Auto-Flow Multi-Spread Storytelling Engine - Research

**Phase:** 11 - Auto-Flow Multi-Spread Storytelling Engine  
**Author:** `gsd-phase-researcher`  
**Date:** 2026-09-23  

---

## 1. Problem Space & Architecture Overview

In studio photography workflows (e.g. Pixellu SmartAlbums and Fundy Designer), photographers frequently import 30 to 100+ curated photos from a wedding, pre-wedding, or portrait session and want them laid out automatically across sequential spreads.

Currently in `OpenSmartAlbum-MacOS`:
- Dropping multiple photos onto an empty spread either fills just that single spread or adds frames haphazardly.
- When 20 photos are dropped, placing them all on one spread creates a cramped, cluttered layout with microscopic frames.
- There is no concept of narrative chapters, chronological burst detection, or cadence distribution.

Phase 11 introduces the **Auto-Flow Multi-Spread Storytelling Engine**:
```
30+ Photos Ingested
       │
       ▼
[ Temporal Burst Clustering ]
  - Sort chronologically (EXIF dateTaken / createdAt / natural filename)
  - Detect time gaps: >30 min (chapter break), >5 min (scene break)
  - Split large groups into 2–6 photos using SPIDR heuristics
       │
       ▼
[ Narrative Cadence & Rhythm Engine ]
  - Assign archetype target: Hero (1), Duo/Trio (2-3), Grid (4-6)
  - Alternate rhythm across spreads to avoid visual fatigue
       │
       ▼
[ Parallel Layout Synthesizer ]
  - Runs off-thread or asynchronously chunked
  - Calls generateDynamicVariations() per cluster
  - Selects highest visual harmony variation per spread
       │
       ▼
[ Atomic Transaction Applier ]
  - Push single previous album/carousel state to historyStore
  - Sequentially append or populate spreads/slides
  - 1 Cmd+Z cleanly reverts entire multi-spread flow
```

---

## 2. Temporal Clustering Mathematical Model

Let $P = [p_1, p_2, \dots, p_N]$ be the photos sorted chronologically.
For each adjacent pair $(p_i, p_{i+1})$, compute time difference:
$$\Delta t_i = t(p_{i+1}) - t(p_i)$$

1. **Chapter Gap ($\Delta t_i \ge 1800\text{s}$ / 30 min):**
   Hard chapter boundary. Must start a new spread/slide.
2. **Scene Gap ($\Delta t_i \ge 300\text{s}$ / 5 min):**
   Soft scene boundary. Strongly preferred split point.
3. **Cap Constraint ($2 \le |C| \le 6$ photos per spread):**
   If a cluster has $>6$ photos, split at largest internal $\Delta t$ or split evenly into balanced subgroups (e.g. 8 photos $\to 4 + 4$; 7 photos $\to 3 + 4$).
4. **Hero Exception ($|C| = 1$):**
   Photos marked with `isFavorite: true` or high star rating ($5\star$) or extreme panoramic aspect ($>2.0$) are eligible for single-photo hero spreads.

---

## 3. Narrative Cadence & Visual Rhythm

A great album tells a story through dynamic visual rhythm:
- **Breath (Hero):** 1 photo (emotional focal point, dramatic portrait, full-bleed ceremony kiss).
- **Dialogue (Duo / Trio):** 2–3 photos (detail shots, bride + groom portraits, ring exchange).
- **Movement (Grid):** 4–6 photos (cocktail party, dynamic dancing, family group combinations).

The cadence engine scores sequence configurations:
$$\text{Cost}(\text{Cadence}) = \sum \text{Penalty}(\text{AdjacentSameCount}) + \text{Penalty}(\text{Overcrowding})$$
This prevents repetitive patterns like $[4, 4, 4, 4]$ or $[2, 2, 2, 2]$.

---

## 4. Off-Thread & Asynchronous Streaming Architecture

For $M = 50$ photos distributed across $K = 12$ spreads, calculating 5–10 candidate layouts per spread with Hungarian bipartite assignment takes $\sim 15\text{ms}$ per spread ($\sim 180\text{ms}$ total).
To guarantee zero dropped frames on high-refresh ProMotion macOS displays:
- Execute via an asynchronous batch pipeline:
  `autoFlowSpreadsAsync(photos, options, onProgress)`
- Yields to the event loop (`await new Promise(r => setTimeout(r, 0))` or `requestAnimationFrame`) between spreads.
- Emits progress events: `onProgress({ percent, currentSpread, totalSpreads })`.

---

## 5. Atomic History Transaction

Before applying auto-flow:
```typescript
useHistoryStore.getState().pushState(currentAlbum); // or currentCarousel
```
All spreads are appended or updated in a single Zustand state mutation:
```typescript
set({
  currentAlbum: updatedAlbumWithAllSpreads,
  activeSpreadId: updatedAlbumWithAllSpreads.spreads[initialIndex].id,
  saveStatus: 'unsaved',
});
```
Result: A single press of `Cmd+Z` (`undo()`) cleanly restores the album to its exact pre-drop state.

---

## 6. Verification Strategy

1. `temporalClusterer.test.ts`: Test burst separation, 30m chapter breaks, 5m scene breaks, and large group splitting ($N = 17 \to$ clusters of $\le 6$).
2. `cadenceEngine.test.ts`: Verify visual rhythm balancing and anti-monotony scoring.
3. `autoFlowMultiSpread.test.ts`: End-to-end auto-flow test on 15, 30, and 50 photos, asserting:
   - All photos are placed (Zero-Loss).
   - Zero empty frames (Zero-Blank).
   - Valid spread count.
   - Atomic single-step undo.
