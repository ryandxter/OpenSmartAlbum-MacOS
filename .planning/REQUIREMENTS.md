# Requirements: OpenSmartAlbum-MacOS (Milestone v1.2.0)

**Defined:** 2026-09-23
**Core Value:** Unlimited generative studio layouting, non-destructive cycling, auto-flow multi-spread storytelling, and fluid in-canvas divider manipulation without photo loss or distortion.

---

## v1.2.0 Requirements

Requirements for Milestone v1.2.0 release, derived from STACK, FEATURES, ARCHITECTURE, and PITFALLS research.

### Generative Geometric Layout Engine & Non-Destructive Cycling (GEN)

- [ ] **GEN-01**: Layout engine dynamically generates valid aspect-preserving partitions for any $N \in [1..15]$ photos without using static fixed-slot templates.
- [ ] **GEN-02**: Switching layout variations via `Spacebar` (next) and `Shift+Space` (previous) preserves all $N$ active photos (Zero-Loss Photo Pool Invariant).
- [ ] **GEN-03**: No empty or unpopulated placeholder frames (`filePath: ''`) are ever created during layout cycling (Zero-Blank Frame Guarantee).
- [ ] **GEN-04**: Optimal bipartite aspect-matching energy minimization ensures landscape photos match horizontal slots and portrait photos match vertical slots.
- [ ] **GEN-05**: Equal-height row normalization and equal-width column normalization align multi-photo strips with 0px rounding seams and proportional aspect-fill cover.
- [ ] **GEN-06**: Input disambiguation cleanly distinguishes single-tap `Spacebar` (cycle layout) from `Space + Drag` (canvas hand pan).

### Auto-Flow Multi-Spread/Slide Storytelling Engine (FLOW)

- [ ] **FLOW-01**: Dropping 10–50+ photos automatically groups and flows them across sequential spreads (Print Album) or slides (Social Carousel).
- [ ] **FLOW-02**: Photos are clustered into chronological narrative chapters using EXIF timestamp bursts (>5 min, >30 min gaps).
- [ ] **FLOW-03**: Narrative pacing heuristics balance visual cadence across spreads (mixing hero breathing moments with detailed multi-photo grids).
- [ ] **FLOW-04**: Heavy combinatorial layout calculations run off-the-main-thread via Web Worker (`layoutEngine.worker.ts`) with chunked progress streaming to prevent UI freezes.
- [ ] **FLOW-05**: Multi-spread auto-flow mutations are wrapped in an atomic history transaction (`executeHistoryTransaction`) so the entire flow can be undone with a single `Cmd+Z`.

### Contextual Right-Click Studio Actions (CTX)

- [ ] **CTX-01**: Right-clicking any photo in Print Album mode provides `Set as Full Bleed Spread (2-Page Panorama)`, expanding it across both pages while automatically reflowing remaining photos.
- [ ] **CTX-02**: Right-clicking any photo in Social Carousel mode provides `Set as Seamless Panorama Span` (spanning 2 or 3 slides) with virtual split-line guides.
- [ ] **CTX-03**: Right-clicking any photo provides `Set as Hero / Anchor Photo`, assigning it the dominant partition slot while recalculating remaining slots.
- [ ] **CTX-04**: Spanning panorama photos enforce print lab spine clearance zones ($X_{\text{spine}} \pm 0.75\text{ in}$) to protect faces from gutter binding.

### Interactive In-Canvas Divider Dragging & Direct Swapping (DIV)

- [ ] **DIV-01**: Konva canvas renders interactive divider guideline hit-areas between adjacent photo frames on hover/selection.
- [ ] **DIV-02**: Dragging a divider line recalculates adjacent slot dimensions smoothly in real-time at 60fps using imperative Konva node manipulation and RAF coalescing (zero React state updates during drag).
- [ ] **DIV-03**: Dragging clamps partition split ratios between 0.15 and 0.85 with minimum dimension enforcement ($W_{\min}, H_{\min} \ge 1.0\text{ in}$) to prevent aspect collapse.
- [ ] **DIV-04**: In-canvas drag-and-drop of one photo onto another swaps their slot assignments while preserving proportional aspect-fill framing and normalized focal points.
- [ ] **DIV-05**: Releasing the divider commits final geometry to store and records exactly one undo/redo history entry.

---

## v2 Requirements (Deferred)

- **AI-01**: Local ONNX face detection and aesthetic saliency scoring for automated focal-point positioning.
- **AI-02**: Semantic visual similarity clustering (color palette and scene categorization).
- **COL-01**: Cloud multi-client proofing and revision comment markers on spreads.

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Unconstrained Freeform Floating Frames | Defeats professional studio grid aesthetics; leads to sloppy overlapping albums. |
| Full-Screen Modal Template Pickers | Disrupts fast creative flow; inline canvas cycling via Spacebar is dramatically faster. |
| Destructive Auto-Cropping | Photos must retain their full underlying pixels with normalized pan/zoom anchors. |
| Cloud-Only Layout Algorithms | OpenSmartAlbum is strictly offline-first and privacy-respecting for professional photographers. |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| GEN-01 | Phase 10 | Pending |
| GEN-02 | Phase 10 | Pending |
| GEN-03 | Phase 10 | Pending |
| GEN-04 | Phase 10 | Pending |
| GEN-05 | Phase 10 | Pending |
| GEN-06 | Phase 10 | Pending |
| FLOW-01 | Phase 11 | Pending |
| FLOW-02 | Phase 11 | Pending |
| FLOW-03 | Phase 11 | Pending |
| FLOW-04 | Phase 11 | Pending |
| FLOW-05 | Phase 11 | Pending |
| CTX-01 | Phase 12 | Pending |
| CTX-02 | Phase 12 | Pending |
| CTX-03 | Phase 12 | Pending |
| CTX-04 | Phase 12 | Pending |
| DIV-01 | Phase 13 | Pending |
| DIV-02 | Phase 13 | Pending |
| DIV-03 | Phase 13 | Pending |
| DIV-04 | Phase 13 | Pending |
| DIV-05 | Phase 13 | Pending |

**Coverage:**
- v1.2.0 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0 ✓

---
*Requirements defined: 2026-09-23*
*Ready for roadmap generation*
