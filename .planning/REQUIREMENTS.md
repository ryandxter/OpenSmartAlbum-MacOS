# Requirements: OpenSmartAlbum-MacOS

**Defined:** 2026-09-21
**Core Value:** High-performance, offline-first desktop photo layout and layered export with native macOS studio ergonomics, seamlessly supporting both physical print albums and modern social media carousels.

## v1 Requirements

### 1. Iconography & Visual Assets (ICON)

- [x] **ICON-01**: Replace all legacy inline/hardcoded SVG markup across the entire workspace with dynamic `lucide-react` components.
- [x] **ICON-02**: Establish standardized icon design tokens (14px micro, 16px compact, 20px standard, 24px featured) with 1.5px and 2.0px stroke widths.
- [x] **ICON-03**: Support dynamic semantic coloring (`currentColor`, primary, muted, destructive, warning) adapting to active UI theme.

### 2. macOS Studio Theming & Interface (UIUX)

- [x] **UIUX-01**: Modern macOS Pro Studio dark theme inspired by Figma and Adobe Lightroom with unified CSS custom property tokens.
- [x] **UIUX-02**: Integrated macOS titlebar with native window drag region, centered project title, and insetting traffic lights (close/minimize/zoom).
- [x] **UIUX-03**: Modular right Inspector with four dedicated accordion sections: (1) Layout & Spacing, (2) Shapes & Borders, (3) Typography, (4) Effects & Shadows.
- [x] **UIUX-04**: Collaborative Left Sidebar with tabbed switching between Photo Tray (with metadata badges) and Carousel Slide Navigator.
- [x] **UIUX-05**: Bottom Workspace Status Bar with zoom slider, canvas DPI/dimension readout, snapping/grid toggles, and active slide indicator.
- [x] **UIUX-06**: Native macOS desktop ergonomics: SF Pro system typography, macOS keyboard shortcuts (`⌘` Cmd instead of `Ctrl`), and trackpad gesture support (pinch-to-zoom, two-finger pan).

### 3. Platform Compatibility & Pure Rust Backend (PLAT)

- [x] **PLAT-01**: Purge all Windows-specific Win32 FFI calls (GDI color sampling, Registry font enumeration, Win32 working set trimming) and implement cross-platform equivalents.
- [x] **PLAT-02**: Enforce 100% pure Rust image and export pipeline (`image`, `rayon`, `fontdue`, `kamadak-exif`, `psd`, `tiff`), eliminating external `libvips` dynamic C-library linking issues.
- [x] **PLAT-03**: Configure Tauri 2 build targets for Universal macOS (`aarch64-apple-darwin` Apple Silicon and `x86_64-apple-darwin` Intel), producing ready-to-sign `.app` bundles and `.dmg` installers.

### 4. Instagram & Social Media Carousel Mode (CARO)

- [ ] **CARO-01**: Dual-Mode Canvas Switcher allowing instant toggling between "Print Album" (physical mm/inch/spine/bleed) and "Instagram Carousel" (pixel-based).
- [ ] **CARO-02**: Standard social aspect ratio presets: 1:1 Square (1080x1080), 4:5 Portrait (1080x1350), and 9:16 Reel/Story (1080x1920).
- [ ] **CARO-03**: Multi-slide seamless panorama support with visible canvas slice guides, enabling photos to span seamlessly across adjacent slides without seam distortion.
- [ ] **CARO-04**: Interactive slide management: reorder slides via drag-and-drop, duplicate slides, and add slides up to the 10-slide Instagram limit.

### 5. Canva/Photoshop Shape Presets & Clipping Masks (SHAPE)

- [ ] **SHAPE-01**: Frame shape clipping presets: Rectangle, Rounded Rect (with individual corner radii), Circle, Oval, Hexagon, Octagon, Star, Scallop/Cloud, and Heart.
- [ ] **SHAPE-02**: Custom SVG Path clipping mask support allowing users to load vector silhouettes as photo clipping shapes.
- [ ] **SHAPE-03**: Customizable borders & strokes: inner/outer border alignment, solid/dashed/double stroke styles, custom colors, and stroke widths.
- [ ] **SHAPE-04**: Drop shadow and depth effects: configurable offset X/Y, blur radius, opacity, and shadow color.
- [ ] **SHAPE-05**: Freeform corner-pin and perspective skew transform controls with accurate Konva hit-detection.
- [ ] **SHAPE-06**: Interoperability with the 2D Topological Spatial Neighbor Graph multi-resize engine to ensure non-rectangular frames maintain gap spacing.

### 6. Advanced Layered Export Engine (EXPO)

- [ ] **EXPO-01**: Layered Adobe Photoshop document (`.psd`) export with discrete raster layers for photo frames, alpha clipping masks, background, and vector/raster text.
- [ ] **EXPO-02**: Automated multi-slide slice export for Instagram carousels, generating numbered individual high-resolution images (`slide_01.jpg`, `slide_02.jpg`, ...) with perfect pixel bounds.
- [ ] **EXPO-03**: High-bit-depth TIFF export with embedded color profiles for professional photo print labs.
- [ ] **EXPO-04**: Print-ready PDF/X export with configurable bleed margins, slug, and vector trim/crop marks.

## v2 Requirements

### Advanced Features (Future)

- **AI-01**: Smart AI photo auto-curation and auto-layout generator based on subject focal points and scene recognition.
- **SYNC-01**: Local Wi-Fi sync between macOS desktop app and iOS companion app for on-location photo proofing.
- **PLUGIN-01**: Adobe Lightroom Classic export plugin to send curated collections directly to OpenSmartAlbum.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Cloud-hosted subscription backend | OpenSmartAlbum-MacOS is 100% local, offline-first, with zero user data telemetry or recurring fee locks. |
| In-app raw image developing (Camera RAW / Lightroom replacement) | Complex color grading and demosaicing belong in dedicated RAW converters; OpenSmartAlbum focuses on layout, presentation, and export. |
| Full vector pen/bezier node illustration tool | Non-core scope creep; shape presets and custom SVG path uploads fulfill all layout mask needs. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PLAT-01 | Phase 1 | Complete |
| PLAT-02 | Phase 1 | Complete |
| PLAT-03 | Phase 1 | Complete |
| ICON-01 | Phase 2 | Complete |
| ICON-02 | Phase 2 | Complete |
| ICON-03 | Phase 2 | Complete |
| UIUX-01 | Phase 2 | Complete |
| UIUX-02 | Phase 2 | Complete |
| UIUX-03 | Phase 2 | Complete |
| UIUX-04 | Phase 2 | Complete |
| UIUX-05 | Phase 2 | Complete |
| UIUX-06 | Phase 2 | Complete |
| CARO-01 | Phase 3 | Pending |
| CARO-02 | Phase 3 | Pending |
| CARO-03 | Phase 3 | Pending |
| CARO-04 | Phase 3 | Pending |
| SHAPE-01 | Phase 4 | Pending |
| SHAPE-02 | Phase 4 | Pending |
| SHAPE-03 | Phase 4 | Pending |
| SHAPE-04 | Phase 4 | Pending |
| SHAPE-05 | Phase 4 | Pending |
| SHAPE-06 | Phase 4 | Pending |
| EXPO-01 | Phase 5 | Pending |
| EXPO-02 | Phase 5 | Pending |
| EXPO-03 | Phase 5 | Pending |
| EXPO-04 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 26 total
- Mapped to phases: 26
- Unmapped: 0 ✓

---
*Requirements defined: 2026-09-21*
*Last updated: 2026-09-21 after initialization*
