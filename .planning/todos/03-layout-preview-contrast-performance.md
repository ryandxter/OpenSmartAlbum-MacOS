# TODO: Smart Layout Preview Contrast Correction & Shuffling Performance

- **ID:** CRIT-03
- **Status:** Pending
- **Severity:** Medium
- **Category:** UI / UX / Performance
- **References:** `FORENSICS.md#incident-3`, `CODE-REVIEW.md#3-smart-layout-rendering--performance`, Screenshots `22.06.11.png` and `22.06.00.png`

## Problem Description
In the Smart Layout panel, inactive layout variations appear completely black / invisible. Users cannot preview the layout geometry before clicking. Shuffling photos causes lag while re-generating variations.

## Root Cause
1. In `TemplatesPanel.tsx`, inactive SVG rectangles use `fill="var(--color-surface, #27272a)"` on a `#18181b` card background. Contrast ratio is 1.14:1, rendering them invisible.
2. Synchronous main-thread execution of `generateAdaptiveLayoutVariations` without memoization caching key causes UI stutter during shuffling.

## Tasks
1. Update inactive tile SVG styles to crisp studio silhouette: `fill="rgba(255, 255, 255, 0.08)"` and `stroke="rgba(255, 255, 255, 0.22)"`.
2. Keep active card highlighted with vibrant blue accent (`#3b82f6` or `var(--color-primary)`).
3. Cache generated layout variations using photo aspect fingerprint.
4. Virtualize or optimize rendering of the 84 layout cards in the sidebar.
