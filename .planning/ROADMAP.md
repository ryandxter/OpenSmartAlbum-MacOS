# Roadmap: OpenSmartAlbum-MacOS

## Overview

OpenSmartAlbum-MacOS overhaul executes across five focused phases: establishing a rock-solid Pure Rust backend ported cleanly to macOS, overhauling the UI and iconography into an Apple-native Pro Studio experience, introducing a dedicated Instagram Carousel engine with seamless panorama spanning, expanding frame geometry with Canva-style shape clipping masks and borders, and delivering a versatile multi-format export suite featuring layered PSDs and carousel slices.

## Phases

- [x] **Phase 1: macOS Foundation & Pure Rust Pipeline** - Purge Win32 dependencies, establish pure Rust image processing, and configure Tauri 2 for Universal macOS.
- [x] **Phase 2: Lucide Iconography & macOS Pro Studio UI** - Full migration to `lucide-react`, Figma/Lightroom dark theme, integrated macOS titlebar, modular inspectors, and Apple desktop ergonomics.
- [ ] **Phase 3: Instagram & Social Media Carousel Mode** - Dual-mode canvas engine, social aspect ratios (1:1, 4:5, 9:16), seamless cross-slide panorama photo spanning, and slide reordering.
- [ ] **Phase 4: Shape Presets, Clipping Masks & Border Styling** - Rich vector clipping masks (Circle, Hexagon, Scallop, Heart, custom SVG), advanced borders/shadows, and 2D topological resize compatibility.
- [ ] **Phase 5: Advanced Layered Export Suite** - Multi-layer Adobe Photoshop (`.psd`) export, automated Instagram carousel slice generator, high-bit-depth TIFF, and print-ready PDF/X.

---

## Phase Details

### Phase 1: macOS Foundation & Pure Rust Pipeline
**Goal**: Remove all Windows-specific code, eliminate external `libvips` C-library dependency, and verify seamless native execution and compilation on macOS (Apple Silicon & Intel).
**Depends on**: Nothing (first phase)
**Requirements**: PLAT-01, PLAT-02, PLAT-03
**Success Criteria** (what must be TRUE):
  1. All Win32 GDI, Windows Registry, and Windows working-set memory calls are replaced with pure Rust cross-platform implementations.
  2. The image processing pipeline uses 100% pure Rust crates (`image`, `rayon`, `kamadak-exif`, `fontdue`), compiling cleanly without needing `libvips` dynamic library linking.
  3. The Tauri 2 configuration successfully targets macOS (`aarch64-apple-darwin` and `x86_64-apple-darwin`), producing functional `.app` and `.dmg` bundles.
**Plans**: 2 plans

Plans:
- [x] 01-01: Remove Win32 bindings and implement cross-platform/macOS native system bridges in `src-tauri`.
- [x] 01-02: Consolidate pure-Rust image decoding/caching pipeline and verify macOS Tauri build/packaging.

---

### Phase 2: Lucide Iconography & macOS Pro Studio UI
**Goal**: Elevate the user interface from a rigid Windows aesthetic to a sleek, dark macOS Pro Studio environment with standardized Lucide icons and Apple HIG ergonomics.
**Depends on**: Phase 1
**Requirements**: ICON-01, ICON-02, ICON-03, UIUX-01, UIUX-02, UIUX-03, UIUX-04, UIUX-05, UIUX-06
**Success Criteria** (what must be TRUE):
  1. Every inline/hardcoded SVG icon is replaced with standardized `lucide-react` components with tokenized sizes and stroke weights.
  2. The interface presents a unified Figma/Lightroom-inspired dark theme with integrated macOS titlebar, window drag region, and traffic lights.
  3. The right properties panel functions as a clean modular inspector with collapsible sections for Layout, Shapes, Typography, and Effects.
  4. The left sidebar cleanly switches between the Photo Pool and Slide Navigator, and the bottom status bar displays live zoom, canvas dimensions, and snapping toggles.
  5. Keyboard navigation adheres to macOS conventions (using `⌘` Cmd shortcuts and trackpad gestures).
**Plans**: 4 plans

Plans:
- [x] 02-01: Pro Studio design tokens, CSS variables, and complete `lucide-react` icon migration across all UI components.
- [x] 02-02: macOS native integrated titlebar (`titleBarStyle: "Overlay"`), drag regions, and Mode Switcher button shell.
- [x] 02-03: Modular 4-section multi-expandable inspector panel and bottom status bar.
- [x] 02-04: macOS keyboard shortcuts (`⌘`), canvas trackpad gestures, and UI polish with full test verification.

---

### Phase 3: Instagram & Social Media Carousel Mode
**Goal**: Introduce a dedicated social media carousel mode alongside physical print album layouts, supporting multi-slide seamless panorama designs and slide management.
**Depends on**: Phase 2
**Requirements**: CARO-01, CARO-02, CARO-03, CARO-04
**Success Criteria** (what must be TRUE):
  1. User can switch instantly between "Print Album" (physical mm/inch with spine gutter) and "Instagram Carousel" (pixel-based with social presets 1:1, 4:5, 9:16).
  2. Kanvas carousel displays interactive slide boundary lines and allows photos to span seamlessly across adjacent slides without visual tearing.
  3. User can add, duplicate, delete, and drag-to-reorder slides up to the 10-slide Instagram carousel limit.
**Plans**: 2 plans

Plans:
- [ ] 03-01: Extend Zustand layout engine and Konva Stage to support pixel-based multi-slide carousel data structures and ratio presets.
- [ ] 03-02: Implement seamless panorama cross-slide photo rendering, slice guide overlays, and drag-and-drop slide reordering.

---

### Phase 4: Shape Presets, Clipping Masks & Border Styling
**Goal**: Expand photo frame styling beyond rectangles to rich Canva and Photoshop-style vector shapes, custom SVG masks, and advanced border/shadow effects.
**Depends on**: Phase 3
**Requirements**: SHAPE-01, SHAPE-02, SHAPE-03, SHAPE-04, SHAPE-05, SHAPE-06
**Success Criteria** (what must be TRUE):
  1. Photo frames can be transformed into vector presets: Circle, Oval, Hexagon, Octagon, Star, Scallop/Cloud, and Heart.
  2. User can upload custom vector SVG paths to clip photo frames.
  3. Borders support configurable inner/outer alignment, solid/dashed/double line styles, colors, and shadows.
  4. Non-rectangular frames integrate seamlessly with the 2D Topological Spatial Neighbor Graph multi-resize engine without gap distortion.
**Plans**: 2 plans

Plans:
- [ ] 04-01: Implement Konva clipping shape engine with vector presets (Circle, Hexagon, Scallop, Heart, etc.) and custom SVG path masks.
- [ ] 04-02: Implement advanced border, stroke, and shadow controls, ensuring full compatibility with multi-frame topological resizing.

---

### Phase 5: Advanced Layered Export Suite
**Goal**: Provide high-grade export options including layered Adobe Photoshop documents (.psd), automated carousel slide slices, print TIFF, and PDF/X.
**Depends on**: Phase 4
**Requirements**: EXPO-01, EXPO-02, EXPO-03, EXPO-04
**Success Criteria** (what must be TRUE):
  1. User can export the layout as an Adobe Photoshop `.psd` file with separated layers for each photo, mask, text, and background.
  2. Carousel layouts automatically export as individual numbered slices (`slide_01.jpg`, `slide_02.jpg`, ...) ready for Instagram upload.
  3. High-resolution TIFF export produces color-accurate, high-bit-depth files for professional printing.
  4. PDF/X export includes accurate bleed margins, trim marks, and vector text fidelity.
**Plans**: 2 plans

Plans:
- [ ] 05-01: Implement Rust-based layered PSD serializer and multi-slide Instagram carousel slice exporter.
- [ ] 05-02: Enhance TIFF and PDF/X print-ready export pipeline with bleed, color profile tagging, and crop marks.

---

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. macOS Foundation & Pure Rust Pipeline | 2/2 | Complete | 2026-09-22 |
| 2. Lucide Iconography & macOS Pro Studio UI | 0/4 | Not started | - |
| 3. Instagram & Social Media Carousel Mode | 0/2 | Not started | - |
| 4. Shape Presets, Clipping Masks & Border Styling | 0/2 | Not started | - |
| 5. Advanced Layered Export Suite | 0/2 | Not started | - |

---
*Roadmap defined: 2026-09-21*
*Last updated: 2026-09-21 after initialization*
