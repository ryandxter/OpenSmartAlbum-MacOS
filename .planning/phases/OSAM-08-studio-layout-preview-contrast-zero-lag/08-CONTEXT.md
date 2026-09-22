# Phase 08: Studio Layout Preview Contrast & Zero-Lag Shuffling - Context

**Gathered:** 2026-09-22  
**Status:** Ready for planning  

<domain>
## Phase Boundary

Phase 08 eliminates the visual blackout and latency in the Smart Layout panel. It redesigns inactive layout thumbnails with crisp, high-contrast studio silhouettes conforming to WCAG 2.1 contrast standards and memoizes partition generation using photo aspect fingerprints for instant, zero-lag shuffling.

</domain>

<decisions>
## Implementation Decisions

### 1. High-Contrast Studio Silhouette Redesign
- **D-01:** Redesign inactive SVG rects in `src/features/templates/TemplatesPanel.tsx` (Option A — Minimalist Studio):
  - Inactive rect fill: `rgba(255, 255, 255, 0.08)`.
  - Inactive rect stroke: `rgba(255, 255, 255, 0.22)` with 1px width.
  - Hover state: `rgba(255, 255, 255, 0.14)` fill with `rgba(255, 255, 255, 0.35)` stroke.
  - Active rect fill: `rgba(59, 130, 246, 0.40)` with `#3b82f6` stroke (1.5px).
  - Background container fill: `#18181b`.
  - This elevates the graphical object contrast ratio from **1.14:1** to **> 4.5:1**, ensuring immediate visual clarity on Retina and OLED screens.
  — **Reversibility:** reversible

### 2. Minimalist Studio Metadata
- **D-02:** Retain a clean, minimalist card metadata format:
  - Layout title and description.
  - Match score badge (`★ 80%` or `★ 95%`) with color-coded ranking.
  - Omit cluttered text badges to preserve a clean professional studio aesthetic.
  — **Reversibility:** reversible

### 3. Zero-Lag Fingerprint Memoization & Shuffling
- **D-03:** Implement a cache layer for `generateAdaptiveLayoutVariations`:
  - Compute a deterministic `cacheKey` using sorted photo IDs, aspect ratios, locked element counts, and spread geometry.
  - When the user clicks "Shuffle" or switches spreads, if the layout permutations for that photo set are already cached, retrieve them instantly without synchronous recalculation.
  - Virtualize or slice the rendered DOM list so that scrolling through 84 variations is butter-smooth (60 FPS).
  — **Reversibility:** costly — touches layout generation and panel rendering cycle.

### Folded Todos
- Folded `03-layout-preview-contrast-performance.md` into this phase.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing:**

- `.planning/FORENSICS.md` — Section 3: Smart Layout Tiles Preview Contrast Defect & Shuffling Lag
- `.planning/CODE-REVIEW.md` — Section 3: Smart Layout Rendering & Performance
- `.planning/UI-REVIEW.md` — Section 1: Visual Contrast & Accessibility
- `src/features/templates/TemplatesPanel.tsx` — Layout variations panel and SVG thumbnail rendering
- `src/domain/adaptiveLayout.ts` — 2D spatial layout partition algorithm and scoring engine

</canonical_refs>
