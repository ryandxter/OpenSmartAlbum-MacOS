# OpenSmartAlbum-MacOS

## Project Vision & Context
OpenSmartAlbum is a professional, native macOS photo album design and social carousel publishing software built on Tauri 2, Rust, React 18, and Konva.js. It provides offline-first, sub-millimeter precision layouting, 300+ DPI print sharpening, layered PSD/TIFF export, and seamless Instagram carousel publishing.

## Current Milestone: v1.2.0 Unlimited Studio Layout & Storytelling Engine

**Goal:** Menghadirkan kapabilitas layouting generatif dinamis tanpa batas (*unlimited possibilities*) dan *multi-spread auto-flow storytelling* standar industri (Pixellu SmartAlbums & Fundy Designer) untuk Print Album dan Social Carousel tanpa bug foto hilang atau frame blank.

**Target features:**
- Phase 10: Aspect-Aware Dynamic Geometric Layout Engine (Zero-Blank, Unlimited Variations for any $N \in [1..15]$ photos)
- Phase 11: Auto-Flow Storytelling & Multi-Spread/Slide Ingestion Engine (Batch Clustering & Orientation-Aware Pacing)
- Phase 12: Contextual Right-Click Studio Actions (Set as Spread / Panorama & Dynamic Re-balancing)
- Phase 13: Interactive In-Canvas Divider Dragging & Direct Photo Swapping

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
