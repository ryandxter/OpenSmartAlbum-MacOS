# OpenSmartAlbum-MacOS

## What This Is

OpenSmartAlbum-MacOS is a professional offline desktop photo album and social carousel layout application natively crafted for macOS (Apple Silicon & Intel), forked and overhauled from AFSNSmartAlbum. It empowers wedding/portrait photographers and visual creators to design physical print photo albums as well as multi-slide seamless Instagram carousels with modern macOS ergonomics, rich Canva-style shape clipping masks, Lucide dynamic icons, and layered multi-format export capabilities.

## Core Value

High-performance, offline-first desktop photo layout and layered export with native macOS studio ergonomics, seamlessly supporting both physical print albums and modern social media carousels.

## Requirements

### Validated

<!-- Inferred from existing codebase mapping and architecture -->

- ✓ Dual-page album spread layout with physical print units (mm, cm, inch, dpi) and spine gutter math — existing
- ✓ 2D Topological Spatial Neighbor Graph multi-frame resize preserving inter-frame gap spacing — existing
- ✓ Progressive image pipeline with custom `$APPCACHE` asset protocol, thumbnail/preview caching, and EXIF orientation — existing
- ✓ Relational persistence with SQLite (WAL mode, versioned migrations) and atomic `.afsn` bundle storage — existing
- ✓ Zero-dependency PDF-1.4 generation and high-resolution canvas rasterization via pure Rust decoders (`image` crate, `rayon`) — existing
- ✓ Vector text rendering with `fontdue` glyph rasterization and two-pass print sharpening — existing
- ✓ Dual entity reset (`↺ Reset Ratio` and `↺ Reset Crop`) for photo frames — existing
- ✓ Smart magnetic alignment snapping engine with dynamic visual HUD guides — existing

### Active

- [ ] **UI & Iconography**: Migrate 100% of hardcoded SVGs to dynamic `lucide-react` with standardized stroke (1.5px/2.0px) and semantic sizing tokens.
- [ ] **macOS Studio Theming & Interface**: Implement macOS Pro Studio look (Figma/Lightroom dark theme, semi-translucent sidebars, unified titlebar with traffic lights, SF Pro typography, desktop shortcuts `⌘`).
- [ ] **Pure Rust macOS Backend**: Eliminate Win32-specific FFI and external `libvips` C-dylib runtime issues; enforce 100% pure Rust pipeline (`image`, `rayon`, `kamadak-exif`, `fontdue`, `psd`, `tiff`) targeting Universal macOS (`aarch64-apple-darwin` & `x86_64-apple-darwin`).
- [ ] **Instagram & Social Carousel Mode**: Add dual-mode toggle to switch between physical print album and Instagram Carousel mode (1080x1080 Square, 1080x1350 Portrait 4:5, 9:16), featuring seamless panorama photo spanning across slide boundaries and slide reordering.
- [ ] **Canva/Photoshop Shape Masks & Borders**: Expand frame clipping beyond rectangles to shape presets (Circle, Oval, Hexagon, Octagon, Star, Scallop/Cloud, Heart), custom SVG path masking, and customizable borders (inner/outer, dashed, shadows).
- [ ] **Advanced Layered Export Engine**: Implement layered Adobe Photoshop document (`.psd`) export with discrete photo, mask, and text layers, automatic multi-slide slice export for Instagram, TIFF high-bit-depth export, and print-ready PDF/X.

### Out of Scope

- **Cloud subscription sync or remote user accounts** — Strict privacy and offline-first guarantee; no cloud database dependencies.
- **In-app heavy raster editing (curves, clone stamp, frequency separation)** — OpenSmartAlbum is a layout and presentation engine; heavy retouching is left to Lightroom/Capture One/Photoshop.
- **Bezier vector pen tool editing** — Focus on clipping mask presets and SVG path import rather than building a full vector illustration editor.

## Context

- Forked with permission from `asrofims/AFSNSmartAlbum` (originally built for Windows).
- Built on Tauri 2, Rust 2021, React 18, Vite 6, Konva.js / react-konva, and SQLite.
- Codebase analysis shows strong foundational canvas math (2D topological graph resize, dual-reset, magnetic snap) but rigid UI styling, Windows-specific system calls, and limited export formats.
- Overhaul targets modern macOS creators needing fast workflow for both physical wedding albums and viral Instagram carousels.

## Constraints

- **Platform**: Universal macOS (`aarch64-apple-darwin` Apple Silicon M1-M4 & `x86_64-apple-darwin` Intel).
- **Backend**: Pure Rust dependencies only — no external C dynamic library (`libvips`) linking issues during macOS compilation and packaging.
- **Offline & Privacy**: 100% offline desktop application with zero data harvesting.
- **Canvas Fidelity**: High-DPI physical rendering accuracy with sub-pixel snapping and print bleed boundaries.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Fork & Rebrand to OpenSmartAlbum-MacOS | Independent repository `ryandxter/OpenSmartAlbum-MacOS` to facilitate complete macOS overhaul and modern feature set | ✓ Good |
| Pure Rust Image Engine | Eliminate external `libvips` dylib dependency in favor of Rust crates (`image`, `rayon`, `psd`, `tiff`) for flawless macOS bundling | ✓ Good |
| Dual-Mode Canvas (Print Album vs Carousel) | Unifies physical book layout with social media workflow in a single professional tool | ✓ Good |
| `lucide-react` Standardized Icon System | Provides dynamic stroke, uniform sizing, and seamless color token inheritance across all tools | ✓ Good |
| macOS Pro Studio UI (Apple HIG + Figma ergonomics) | Replaces stiff Windows desktop aesthetic with sleek dark theme, integrated titlebar, and modular inspectors | ✓ Good |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-09-21 after initialization*
