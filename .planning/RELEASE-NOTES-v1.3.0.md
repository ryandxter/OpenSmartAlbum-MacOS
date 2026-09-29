# Release Notes: OpenSmartAlbum v1.3.0

## 🌟 What's New in v1.3.0: Workspace Isolation, Carousel Persistence & Vector Shape Polish

This major milestone release introduces clean workspace isolation between Print Album and Social Carousel environments, complete end-to-end SQLite and package persistence for Social Carousel projects, atomic batch multi-photo drag-and-drop, and Figma-grade mathematical vertex tangent fillet corner radii for all vector shape masks.

---

### 🚀 Key Highlights & New Capabilities

#### 1. 🛡️ Complete Social Carousel SQLite & `.afsn` Persistence (Phase 15)
* **Full SQLite v16 Schema Migration:** Dedicated tables and columns for carousel slides, frames, aspect ratios, custom backgrounds, and slide sequence orders.
* **Bi-directional IPC Save & Load:** Seamless serialization and hydration of complete carousel projects to SQLite and `.afsn` project archives.
* **Real-time Dirty Tracking:** Dynamic titlebar status indicator transitioning from green ("Saved") to amber ("Unsaved Changes") upon any canvas mutation.
* **Native macOS Window Close Guard:** Intercepts window closing and application quitting when unsaved changes exist, prompting with a native macOS confirmation sheet.
* **Slide Thumbnail Caching:** High-performance disk caching for carousel slide miniatures.

#### 2. 🔀 Workspace Isolation & Mode State Synchronization (Phase 16)
* **Global `activeMode` Hoisting:** `activeMode` hoisted to `appStore`, enabling unified mode awareness across all components and dialogs.
* **Independent Viewport Zooms:** Seamlessly switch between Print Album and Social Carousel with isolated zoom and pan states (`printZoom` vs `carouselZoom`) without scaling jumps.
* **Mode-Guarded Shortcuts & Titlebar Controls:** Titlebar buttons (Undo/Redo, "Add Text", Export) and single-key shortcuts (`T`, `L`, `G`, `P`) dispatch exclusively to the active workspace mode, preventing silent cross-mode mutations.
* **Slide Coordinate & Style Preservation:** Reordering, duplicating, or deleting slides maintains frame attachments. Layout cycling (`Spacebar`) preserves custom borders, corner radii, and vector masks.

#### 3. 🎯 Resilient Multi-Photo Drag-and-Drop & Context Routing (Phase 14)
* **In-Bounds Drag Ghost Badge:** Eliminates macOS WebKit snapshot clipping and drag cancellations by bounding badge dimensions and using non-interfering opacity.
* **Atomic Batch Frame Placement:** Dropping multiple photos onto a slide commits frame creation into a single atomic history transaction (`Cmd+Z` undoes the entire placement).
* **Mode-Aware Context Menu & Double-Click Routing:** Right-clicking or double-clicking photos in Filmstrip intelligently routes placement to the active slide in Carousel mode or active spread in Print mode.

#### 4. 📐 Figma-Grade Vector Shape Mask Corner Radii & Polygon Fillets (Phase 17)
* **Mathematical Tangent Fillet Engine:** Implemented circular fillet arcs ($\theta = \arccos(\hat{u} \cdot \hat{v})$, $t = r / \tan(\theta/2)$) with dynamic self-intersection clamping ($d_{\max} = \min(L_{in}, L_{out})/2$) in `src/domain/shapes.ts`.
* **Unlocked Corner Radius in Inspector:** Sliders and numeric inputs are active for Hexagon, Octagon, Star, Scallop, and Heart presets.
* **Independent Tip & Valley Controls for Star:** Users can independently round outer tips and inner valleys with smooth alternating sweep flags.
* **New Oval Preset:** First-class Oval button in the preset grid with contour borders and pan/zoom crop support.
* **Compound SVG Mask Parser & ViewBox Normalizer:** `normalizeCustomSvgMask` merges `<path>`, `<circle>`, `<rect>`, `<ellipse>`, `<polygon>`, `<polyline>` across nested `<g>` elements, enforcing aspect-fit containment and centering without distortion.
* **Rust Export Engine Parity:** `psd_writer.rs` samples vertex fillet arcs and parses SVG arc (`A`/`a`) tokens for 100% visual parity in 300 DPI PSD/PNG exports.

---

### 📦 Checksums & Assets
* **macOS Apple Silicon / Universal Installer:** `OpenSmartAlbum_1.3.0_aarch64.dmg`
  - **SHA-256:** `1cb3a511e98868161150302fcd9d67e827ee20f82e9707b3f9b5240ecfc86b09`
