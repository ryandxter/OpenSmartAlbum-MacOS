# Requirements: OpenSmartAlbum-MacOS (Milestone v1.3.0)

**Defined:** 2026-09-28
**Core Value:** Solid workspace mode isolation, complete SQLite and package persistence for Social Carousel, resilient multi-photo drag-and-drop, and Figma-grade polygon corner radius fillets.

---

## v1.3.0 Requirements

Requirements for Milestone v1.3.0 release, derived from Forensics Post-Mortem, 6-Pillar UI Review, and Comprehensive Code Review.

### Carousel Canvas Drag-and-Drop & Filmstrip UX (CAR)

- [ ] **CAR-01**: User can drag multiple selected photos (or batch handle) from Filmstrip onto `CarouselCanvas` (`.stageWrapper`) and have them reliably placed on the target slide without canvas blanking or WebKit drag cancellation.
- [ ] **CAR-02**: Drag ghost badge (`#afsn-drag-ghost-badge`) is positioned within visible bounds with non-interfering opacity (`opacity: 0.01`, `pointer-events: none`), preventing macOS WebKit drag session cancellations.
- [ ] **CAR-03**: Dropping $N$ photos onto a slide batches frame creation into a single state update with a single atomic undo/redo history entry.
- [ ] **CAR-04**: Filmstrip context menu (`PhotoContextMenu`) and double-click actions detect `activeMode`, routing photo placement to the active slide in Carousel mode and to the active spread in Print Album mode.

### Social Carousel Persistence & Database Storage (PERS)

- [ ] **PERS-01**: SQLite schema introduces tables/columns for carousel projects, persisting slides, photo frames, aspect ratios, slide order, and background colors.
- [ ] **PERS-02**: Project save (`Cmd+S`, menu item, and autosave) saves both Print Album and Carousel state seamlessly without data loss.
- [ ] **PERS-03**: Reopening an `.afsn` project or SQLite database fully restores all carousel slides, frame geometries, and customizations.
- [ ] **PERS-04**: Carousel store tracks `isDirty` state, displaying correct save indicator status in the title bar and warning on unsaved window close.

### Workspace Isolation & Mode State Synchronization (ISO)

- [ ] **ISO-01**: Elevate `activeMode` (`'print' | 'carousel'`) to global `appStore` with auto-detection on project open based on canvas unit (`px` vs `mm/in`).
- [ ] **ISO-02**: Viewport zoom and pan state are cleanly isolated (`printZoom` vs `carouselZoom`), preventing accidental scale jumps when switching modes.
- [ ] **ISO-03**: Title bar controls (Undo/Redo, "Add Text", Export) and keyboard shortcuts dispatch strictly to the active mode's store.
- [ ] **ISO-04**: Reordering, deleting, or duplicating slides in `carouselStore` automatically recalculates and shifts contained frames' absolute `x` coordinates, preventing frame detachment.
- [ ] **ISO-05**: Dynamic layout cycling and auto-flow in Carousel mode preserve frame border styling and shape masks instead of stripping them.

### Vector Shape Mask Corner Radii & Polygon Tangent Fillets (VEC)

- [ ] **VEC-01**: Inspector's `ShapesBordersSection` displays Corner Radius slider and individual corner inputs for all polygon shapes (Hexagon, Octagon, Star, Scallop, Heart), removing the artificial rectangle-only restriction.
- [ ] **VEC-02**: Implement mathematical vertex tangent fillet arc algorithm (`c.arcTo` in Canvas 2D and quadratic bezier/arc in SVG) in `src/domain/shapes.ts` to smoothly round polygon and star vertices.
- [ ] **VEC-03**: Custom SVG shape upload normalizes viewBox dimensions and handles multi-path clipping groups properly.
- [ ] **VEC-04**: Oval shape preset is added to the UI button presets in `ShapesBordersSection.tsx` with full contour and crop support.

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
| CAR-01 | Phase 14 | Pending |
| CAR-02 | Phase 14 | Pending |
| CAR-03 | Phase 14 | Pending |
| CAR-04 | Phase 14 | Pending |
| PERS-01 | Phase 15 | Pending |
| PERS-02 | Phase 15 | Pending |
| PERS-03 | Phase 15 | Pending |
| PERS-04 | Phase 15 | Pending |
| ISO-01 | Phase 16 | Pending |
| ISO-02 | Phase 16 | Pending |
| ISO-03 | Phase 16 | Pending |
| ISO-04 | Phase 16 | Pending |
| ISO-05 | Phase 16 | Pending |
| VEC-01 | Phase 17 | Pending |
| VEC-02 | Phase 17 | Pending |
| VEC-03 | Phase 17 | Pending |
| VEC-04 | Phase 17 | Pending |

**Coverage:**
- v1.3.0 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0 ✓

---
*Requirements defined: 2026-09-28*
*Ready for roadmap generation*
