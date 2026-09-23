# Release Notes: OpenSmartAlbum v1.2.4

## 🌟 What's New in v1.2.4: Marquee Selection & WebKit Multi-Photo Drag-and-Drop

This release delivers major upgrades to the Filmstrip library interaction model, resolving multi-photo drag-and-drop issues in macOS WebKit, introducing native rubberband marquee drag-selection, and adding end-to-end headless browser test verification.

---

### 🚀 Key Improvements & Fixes

#### 1. 🖱️ Native Rubberband Marquee Drag-Selection in Filmstrip
* Added pointer drag tracking (`pointerdown`, `pointermove`, `pointerup`) with pointer capture on the Filmstrip container.
* Dragging across photo thumbnails now draws a translucent, high-contrast cyan selection box (`.marqueeBox`) in real-time.
* Performs real-time 2D AABB collision detection against photo card DOM bounds to select all intersected items.
* Supports holding `Shift` to add to existing selections, or clicking empty space to deselect.

#### 2. ⚡ WebKit Multi-Photo Drag-and-Drop Reliability (macOS WKWebView)
* **Fixed WebKit Drag Cancellation Bug:** Replaced unattached memory `<canvas>` elements in `e.dataTransfer.setDragImage()` with a DOM-attached badge (`#afsn-drag-ghost-badge`). This completely eliminates WebKit's native OS drag cancellation when dragging multiple photos.
* **Resilient CSV `text/plain` Encoding:** Multi-photo selections serialize all IDs as comma-separated values (`ids.join(',')`), ensuring all photo IDs reach the canvas even if the OS pasteboard filters custom MIME types.
* **Deferred Dragged IDs Store Clearance:** Added debounced cleanup on `dragend` to eliminate race conditions between the drop target handler and drag termination.
* **Photo Format Null Safety:** Fixed a critical `TypeError: Cannot read properties of undefined (reading 'toUpperCase')` error when photos are loaded without explicit format metadata.

#### 3. 🎯 Direct Draggable Batch Action Handle
* Added a dedicated draggable handle button `[::: Drag All (X)]` directly inside the floating `BatchActionBar`.
* Users can now grab the batch bar itself and drop all selected photos directly onto any slide or spread in one fluid motion.

#### 4. 🧪 Playwright Headless Browser E2E Test Suite (42/42 Checks Passed)
* Automated end-to-end browser test suite (`scripts/e2e-headless-suite.ts`) verifying 1:1 runtime fidelity:
  - **All 11 Print Album Presets:** 20×20 cm, 30×30 cm, 30×20 cm, 20×30 cm, A4 Portrait/Landscape, 8×8, 10×8, 8×10, 12×8, 12×12.
  - **All Carousel Aspect Ratios:** 1:1 Square, 4:5 Portrait, 9:16 Story/Reel.
  - **Complete Slide Range (2 to 10 Slides):** Verified slide generator and slide strip miniature previews.
  - **Physical Mouse Pointer Simulation:** Tested marquee drag-selection and multi-photo drop onto Slide 4.
  - **Vector Shapes & Borders:** Verified rectangle, rounded, circle, heart, star, diamond, and hexagon clipping with borders.
  - **Dynamic Layouts & Seamless Panoramas:** Verified slide coordinate preservation and multi-slide panoramic spans.

---

### 📦 Checksums & Assets
* **macOS Apple Silicon / Universal Installer:** `OpenSmartAlbum_1.2.4_aarch64.dmg`
