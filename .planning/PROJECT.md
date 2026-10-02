# OpenSmartAlbum-MacOS

## Project Vision & Context
OpenSmartAlbum is a professional, native macOS photo album design and social carousel publishing software built on Tauri 2, Rust, React 18, and Konva.js. It provides offline-first, sub-millimeter precision layouting, 300+ DPI print sharpening, layered PSD/TIFF export, and seamless Instagram carousel publishing.

## Current Milestone: v1.4.0 Workflow & Canvas Precision Suite

**Goal:** Deliver studio-grade canvas precision and workflow parity: Direct-Canvas Rich Text Color/Hex bar (v1.2.1 parity), Decorative/Overlay Exclusion in Adaptive Layout (v1.1.17 parity), Quick Guides & Snapping popover, Trackpad/wheel horizontal scrolling drawer, Visual Layers management & reordering panel, and sub-pixel hairline border scaling parity.

**Target features:**
1. **Direct-Canvas Rich Text Color & Inline Hex Editor (v1.2.1 Parity):** Floating inline color control with visible and editable Hex input (`#RGB` / `#RRGGBB`), text background highlight styling, mixed-color selection feedback, and focus-preserving text selection during color picking.
2. **Adaptive Layout Decorative/Overlay Exclusion (`excludeFromAdaptiveLayout`) & Swap Shortcut (v1.1.17 Parity):** Flag to exclude logos, watermarks, and overlay frames from adaptive layout reshuffling while remaining editable; keyboard shortcut `S` to trigger swap handle or swap two selected frames.
3. **Quick Guides & Snapping Popover (v1.1.15 Parity):** Dedicated quick-settings button beside Spread/Post counter in bottom navigator to toggle canvas guides, bleed boundaries, safe margins, and snapping thresholds without opening full app settings.
4. **Direct Wheel / Trackpad Horizontal Scroll (v1.1.15 Parity):** Native horizontal scrolling for Page Navigator and Slide Navigator thumbnail drawers via vertical wheel delta and trackpad gestures without requiring the Shift key.
5. **Visual Layers Management & Reordering Panel (v1.1.13 Parity):** Dedicated studio layers panel supporting drag-and-drop z-index reordering, multi-selected layer block dragging, midpoint insertion indicator, lock/hide toggles, and undo integration.
6. **Sub-Pixel Hairline Border Scaling Parity (v1.1.11 Parity):** Exact proportional scaling and sub-pixel rendering for ultra-thin borders (0.02 - 0.1 mm) across Editor Canvas, Page Navigator thumbnails, and Export Preview.

## Shipped Milestones Summary

### Milestone v1.3.0 (Shipped 2026-09-29)
1. **Carousel Multi-Photo Drag-and-Drop:** In-bounds ghost badge preventing macOS WebKit clipping, atomic batch placement with single history transaction.
2. **Carousel Persistence & Database Storage:** Full SQLite v16 schema, `.afsn` archive serialization, dirty tracking, and native macOS window close guard.
3. **Workspace Isolation & Multi-Mode Sync:** Global `activeMode` hoisting, independent viewport zooms (`printZoom` vs `carouselZoom`), and mode-guarded keyboard shortcuts.
4. **Vector Shape Mask Corner Radii & Fillets:** Figma-grade vertex tangent fillet circular arcs ($\theta = \arccos(\hat{u} \cdot \hat{v})$) with dynamic clamp, unlocked Inspector corner radius sliders, compound SVG normalizer with aspect-fit containment, and Rust export engine parity.

### Milestone v1.2.0 (Shipped 2026-09-28)
1. Aspect-Aware Dynamic Geometric Layout Core (Zero-Blank R-BSP partitioning, unlimited variations for 1..15 photos, non-destructive Spacebar cycling).
2. Auto-Flow Multi-Spread Storytelling Engine (EXIF timestamp burst clustering, narrative pacing, multi-spread/slide ingestion with atomic single-step undo).
3. Contextual Right-Click Studio Actions & Panorama Span Engine (Full Bleed Spread, Seamless Carousel Span, Hero anchor rebalancing, spine clearance).
4. Interactive In-Canvas Divider Dragging & Direct Photo Swapping (60fps Konva divider dragging with RAF coalescing, cyan hover swap ring, single history entry).

### Milestone v1.1.0 (Shipped 2026-09-23)
1. Native macOS Finder file and folder drag-and-drop dual ingestion.
2. Full photo placement and hybrid layout generation in Social Carousel Mode.
3. High-contrast studio layout preview tiles and zero-lag memoized shuffling.
4. Robust vector shape masking with in-shape pan/zoom crop and contour borders.

### Milestone v1.0 Foundation & Core Canvas (Shipped)
1. Tauri 2 + React 18 + Konva canvas foundation, photo tray, inspector styling, and 300 DPI PDF export.

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

## Architecture Constraints
- Tauri 2 + Rust backend (no cloud services, no Node.js/Express in production).
- React 18 + Zustand + Konva.js canvas rendering.
- macOS Human Interface Guidelines (SF Pro typography, neutral dark palette `#18181b`, zero chromatic cast).
- Strict backward compatibility with `.afsn` project format and SQLite persistence.
