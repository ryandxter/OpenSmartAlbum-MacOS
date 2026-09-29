# OpenSmartAlbum-MacOS

## Project Vision & Context
OpenSmartAlbum is a professional, native macOS photo album design and social carousel publishing software built on Tauri 2, Rust, React 18, and Konva.js. It provides offline-first, sub-millimeter precision layouting, 300+ DPI print sharpening, layered PSD/TIFF export, and seamless Instagram carousel publishing.

## Current State: v1.3.0 Shipped (2026-09-29)

**Core Value Delivered:** Solid workspace mode isolation, complete SQLite and package persistence for Social Carousel, resilient multi-photo drag-and-drop, and Figma-grade polygon corner radius fillets.

### Shipped Milestones Summary

#### Milestone v1.3.0 (Shipped 2026-09-29)
1. **Carousel Multi-Photo Drag-and-Drop:** In-bounds ghost badge preventing macOS WebKit clipping, atomic batch placement with single history transaction.
2. **Carousel Persistence & Database Storage:** Full SQLite v16 schema, `.afsn` archive serialization, dirty tracking, and native macOS window close guard.
3. **Workspace Isolation & Multi-Mode Sync:** Global `activeMode` hoisting, independent viewport zooms (`printZoom` vs `carouselZoom`), and mode-guarded keyboard shortcuts.
4. **Vector Shape Mask Corner Radii & Fillets:** Figma-grade vertex tangent fillet circular arcs ($\theta = \arccos(\hat{u} \cdot \hat{v})$) with dynamic clamp, unlocked Inspector corner radius sliders, compound SVG normalizer with aspect-fit containment, and Rust export engine parity.

#### Milestone v1.2.0 (Shipped 2026-09-28)
1. Aspect-Aware Dynamic Geometric Layout Core (Zero-Blank R-BSP partitioning, unlimited variations for 1..15 photos, non-destructive Spacebar cycling).
2. Auto-Flow Multi-Spread Storytelling Engine (EXIF timestamp burst clustering, narrative pacing, multi-spread/slide ingestion with atomic single-step undo).
3. Contextual Right-Click Studio Actions & Panorama Span Engine (Full Bleed Spread, Seamless Carousel Span, Hero anchor rebalancing, spine clearance).
4. Interactive In-Canvas Divider Dragging & Direct Photo Swapping (60fps Konva divider dragging with RAF coalescing, cyan hover swap ring, single history entry).

#### Milestone v1.1.0 (Shipped 2026-09-23)
1. Native macOS Finder file and folder drag-and-drop dual ingestion.
2. Full photo placement and hybrid layout generation in Social Carousel Mode.
3. High-contrast studio layout preview tiles and zero-lag memoized shuffling.
4. Robust vector shape masking with in-shape pan/zoom crop and contour borders.

#### Milestone v1.0 Foundation & Core Canvas (Shipped)
1. Tauri 2 + React 18 + Konva canvas foundation, photo tray, inspector styling, and 300 DPI PDF export.

## Next Milestone: Run `/gsd-new-milestone`

Potential directions for v1.4.0+:
- **Local AI Intelligence:** On-device ONNX face detection, focal point auto-centering, aesthetic saliency ranking.
- **Client Proofing Engine:** Interactive offline proofing export with client review annotations and selection filtering.
- **Advanced Typography & Vector Badges:** Custom font bundling, SVG watermark stamps, and decorative flourish masks.

## Architecture Constraints
- Tauri 2 + Rust backend (no cloud services, no Node.js/Express in production).
- React 18 + Zustand + Konva.js canvas rendering.
- macOS Human Interface Guidelines (SF Pro typography, neutral dark palette `#18181b`, zero chromatic cast).
- Strict backward compatibility with `.afsn` project format and SQLite persistence.
