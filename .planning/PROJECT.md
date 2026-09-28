# OpenSmartAlbum-MacOS

## Project Vision & Context
OpenSmartAlbum is a professional, native macOS photo album design and social carousel publishing software built on Tauri 2, Rust, React 18, and Konva.js. It provides offline-first, sub-millimeter precision layouting, 300+ DPI print sharpening, layered PSD/TIFF export, and seamless Instagram carousel publishing.

## Current Milestone: v1.3.0 Workspace Isolation, Carousel Persistence & Vector Shape Polish

**Goal:** Menghadirkan isolasi workspace Print Album vs Social Carousel yang solid, persistensi penuh Carousel ke SQLite dan `.afsn`, keandalan drag-and-drop batch multi-foto tanpa blank frame, perbaikan perutean context menu/double-click, serta fillet corner radius pada seluruh vector shape masks.

**Target features:**
- Phase 14: Carousel Canvas Multi-Photo Drag-and-Drop & Filmstrip Context Routing (Drop listener on `.stageWrapper`, in-bounds ghost badge, single-undo batch placement, mode-aware context menu & double click)
- Phase 15: Social Carousel Full SQLite & Package Persistence (Database schema for carousel slides & frames, save/load in `.afsn` packages, dirty state tracking & autosave)
- Phase 16: Workspace Isolation & Mode State Synchronization (Global `activeMode` in `appStore`, isolated zoom levels, mode-guarded undo/redo & titlebar actions, slide coordinate preservation on reorder/delete)
- Phase 17: Vector Shape Mask Corner Radii & Polygon Tangent Fillets (Figma-style vertex fillet/tangent rounding algorithm in `shapes.ts`, unlocked Inspector corner radius controls for all polygons, normalized SVG viewBox)

## Milestone v1.2.0 Summary (Completed)
1. Aspect-Aware Dynamic Geometric Layout Core (Zero-Blank R-BSP partitioning, unlimited variations for 1..15 photos, non-destructive Spacebar cycling).
2. Auto-Flow Multi-Spread Storytelling Engine (EXIF timestamp burst clustering, narrative pacing, multi-spread/slide ingestion with atomic single-step undo).
3. Contextual Right-Click Studio Actions & Panorama Span Engine (Full Bleed Spread, Seamless Carousel Span, Hero anchor rebalancing, spine clearance).
4. Interactive In-Canvas Divider Dragging & Direct Photo Swapping (60fps Konva divider dragging with RAF coalescing, cyan hover swap ring, single history entry).

## Milestone v1.1.0 Summary (Completed)
1. Native macOS Finder file and folder drag-and-drop dual ingestion.
2. Full photo placement and hybrid layout generation in Social Carousel Mode.
3. High-contrast studio layout preview tiles and zero-lag memoized shuffling.
4. Robust vector shape masking with in-shape pan/zoom crop and contour borders.

## Architecture Constraints
- Tauri 2 + Rust backend (no cloud services, no Node.js/Express in production).
- React 18 + Zustand + Konva.js canvas rendering.
- macOS Human Interface Guidelines (SF Pro typography, neutral dark palette `#18181b`, zero chromatic cast).
- Strict backward compatibility with `.afsn` project format and SQLite persistence.

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
