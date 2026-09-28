# Phase 10: Dynamic Generative Layout Core & Non-Destructive Studio Cycling - Context

**Gathered:** 2026-09-23
**Status:** Ready for planning
**Mode:** Autonomous smart-discuss (grounded in STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md)

<domain>
## Phase Boundary

Implement a pure TypeScript geometric partitioner and aspect-matching engine. Generate valid, aspect-preserving layouts for any $N \in [1..15]$ photos without static templates; provide non-destructive `Spacebar` / `Shift+Space` layout cycling with zero photo dropping and zero blank frames.

Covers Requirements:
- `GEN-01`: Layout engine dynamically generates valid aspect-preserving partitions for any $N \in [1..15]$ photos without using static fixed-slot templates.
- `GEN-02`: Switching layout variations via `Spacebar` (next) and `Shift+Space` (previous) preserves all $N$ active photos (Zero-Loss Photo Pool Invariant).
- `GEN-03`: No empty or unpopulated placeholder frames (`filePath: ''`) are ever created during layout cycling (Zero-Blank Frame Guarantee).
- `GEN-04`: Optimal bipartite aspect-matching energy minimization ensures landscape photos match horizontal slots and portrait photos match vertical slots.
- `GEN-05`: Equal-height row normalization and equal-width column normalization align multi-photo strips with 0px rounding seams and proportional aspect-fill cover.
- `GEN-06`: Input disambiguation cleanly distinguishes single-tap `Spacebar` (cycle layout) from `Space + Drag` (canvas hand pan).

</domain>

<decisions>
## Implementation Decisions

1. **Pure TypeScript Domain Engine in `src/domain/layout/`:**
   - `src/domain/layout/bspEngine.ts`: Slicing tree decomposition with editorial harmonic split ratios ($0.618, 0.667, 0.5$).
   - `src/domain/layout/rowColumnNormalizer.ts`: Equal-height row and equal-width column normalization formulas.
   - `src/domain/layout/aspectMatcher.ts`: Logarithmic aspect matching energy minimization and bipartite assignment.
   - `src/domain/layout/generator.ts`: Unified facade generating strictly $N$ slots for $N$ photos given arbitrary container bounds.

2. **Integration into Stores:**
   - In `editorStore.ts`: Add `cycleLayout(direction: 'next' | 'prev')` acting on active spread. Always passes the spread's active non-empty photos to the generator, completely replacing the legacy preset switch that discarded photos.
   - In `carouselStore.ts`: Add `cycleSlideLayout(direction: 'next' | 'prev')` acting on `activeSlideIndex`. Uses the same unified layout generator, guaranteeing zero blank frames (`filePath: ''`).

3. **Keyboard Disambiguation:**
   - In `WorkspaceLayout.tsx`: Listen to `keydown` / `keyup` for `Space`. When Space is pressed without drag movements within 180ms or on keyup without drag, trigger `cycleLayout('next')` (or `prev` if Shift is held). If mouse drag starts while Space is held, activate canvas pan mode.

4. **Zero-Blank Invariant:**
   - Eliminate hardcoded `createFrame(photos[i])` where `photos[i] === undefined` creates phantom frames. Partitions generated will always equal `photos.length`.

</decisions>

<code_context>
## Existing Code Insights

- `src/domain/adaptiveLayout.ts`: Contains existing memoization cache and raw partition heuristics.
- `src/domain/carouselLayout.ts`: Contains legacy static presets that caused the user's reported bug.
- `src/features/templates/TemplatesPanel.tsx`: Displays layout cards; will bind to the new dynamic generator.
- `src/features/workspace/WorkspaceLayout.tsx`: Handles global keyboard shortcuts.

</code_context>
