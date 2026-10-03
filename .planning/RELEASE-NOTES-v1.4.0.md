# Release Notes: OpenSmartAlbum v1.4.0

## 🌟 What's New in v1.4.0: Workflow & Canvas Precision Suite

Milestone v1.4.0 delivers studio-grade canvas precision, direct rich text formatting, on-device AI face detection & studio auto-framing powered by YuNet in pure Rust, an interactive Studio Layers management panel, decorative layout exclusion, dedicated Quick Guides & Snapping popover, and sub-pixel hairline border scaling parity.

---

### 🚀 Key Highlights & New Capabilities

#### 1. 🧠 On-Device AI Face Detection & Studio Framing Engine (Phase 23)
* **Embedded YuNet ONNX in Rust Backend:** Lightweight embedded `face_detection_yunet_2023mar.onnx` executed natively via `tract-onnx` in pure Rust with multi-threaded Rayon batch analysis (<10ms per photo) and 100% offline privacy.
* **5-Landmark Detection & Telemetry:** Offline detection of facial bounding boxes and 5 key landmarks (left eye, right eye, nose tip, left mouth corner, right mouth corner) with roll degree tilt and symmetry ratio metrics.
* **Studio Framing Presets & Math:** Closed-form coordinate inversion for standard studio portrait framing rules:
  - `Pasfoto Formal (3x4 / 4x6)`: 10% headroom clearance and optical center alignment.
  - `Wisuda UNY 50% Shoulder`: Eye line on upper third with 50% shoulder-to-frame ratio anchor.
  - `Portrait Rule of Thirds`: Dynamic gaze-direction bias and thirds golden alignment.
  - `Natural Center`: Balanced optical center for candid portraits.
  - `Group Auto-Centering`: Multi-face bounding box expansion with cluster headroom.
* **Canvas Visual Guides & Culling Badges:** Non-interactive Konva reticle overlay (`Shift+F`), contextual right-click "AI Auto-Frame 🪄" menu, and Filmstrip quality badges (`✨ HERO`, `🎯 SHARP`, `👤 1` / `👥 N`).
* **Face-Aware Adaptive Layout:** Spacebar layout shuffling and multi-photo distribution preserve face landmark regions, preventing accidental face or head clipping.

#### 2. 📑 Visual Studio Layers Management & Reordering Panel (Phase 21)
* **Dedicated Studio Layers Tab:** First-class Inspector tab with live badge counter showing the total number of elements on the active spread or carousel slide.
* **8-State Interactive Layer Cards:** Cards with polymorphic thumbnail previews (photo asset bitmaps via Tauri cache, typography glyphs with text snippet, vector shape silhouettes).
* **Midpoint Crossing Drag-and-Drop:** Pointer-based drag-and-drop z-index reordering with midpoint crossing calculation ($Y_{\text{mid}} = \text{top} + \text{height} / 2$) and 4px deadband hysteresis buffer.
* **Multi-Selection Block Drag:** Move multiple non-contiguous or contiguous selected layers together as a unified block to a new z-index slot in one drag operation.
* **Per-Layer & Master Actions:** Quick action controls (toggle visibility/hide, toggle lock, delete, inline double-click rename) and master header batch actions (Lock All / Unlock All, Hide All / Show All) with single atomic undo/redo history transactions.

#### 3. 🎨 Direct-Canvas Rich Text Color Bar & Inline Hex Editor (Phase 18)
* **Floating Direct-Canvas Toolbar:** Rich text formatting bar anchored directly above the active inline text box.
* **Inline Hex Color Inputs:** Direct `#RGB` and `#RRGGBB` inputs with real-time normalization, Enter commit, and immediate color preview.
* **Background Highlight Color:** Support for text background highlight fill styling.
* **Mixed-Color Detection:** Multi-styled selections display clear visual "Mixed" feedback without overwriting distinct styles.
* **Zero-Blur Focus Preservation:** Interacting with color picker popovers preserves text selection and caret focus without dismissing the active edit session.

#### 4. 🧭 Dedicated Quick Guides & Snapping Popover + Direct Drawer Wheel Scroll (Phase 20)
* **Quick Guides Popover:** Dedicated settings button beside the Spread/Post counter in the bottom navigator bar for instant access to alignment settings.
* **Dynamic Snapping & Grid Toggles:** Toggle magnetic snapping, snap sensitivity threshold (1mm to 10mm), spine centerlines, rule of thirds, bleed trim lines, and safe print margins on the fly.
* **Direct Wheel-to-Horizontal Drawer Scroll:** Smart vertical mouse-wheel (`deltaY`) translation into smooth horizontal scrolling (`scrollLeft`) across the thumbnail drawer without requiring `Shift`.

#### 5. 🛡️ Adaptive Layout Decorative Exclusion & Photo Swap Shortcut (Phase 19)
* **Decorative Layout Exclusion:** Mark photo elements (logos, watermarks, stamps, decorative overlays) with `excludeFromAdaptiveLayout: true` so they stay anchored during Spacebar layout variations.
* **Obstacle Subtraction Engine:** 2D bin-packing algorithm dynamically subtracts excluded element bounding boxes from available partition space so photos pack cleanly around static overlays.
* **Enhanced Photo Swap Shortcut (`S`):** Pressing `S` on a single selected photo frame toggles the interactive swap ring handle; pressing `S` on two selected photo frames triggers an instant atomic swap.

#### 6. 🔬 Sub-Pixel Hairline Border Scaling Parity & Continuous Anti-Aliasing (Phase 22)
* **Removed Artificial Pixel Floor:** Eliminated 2px minimum border constraints across Editor Canvas, Page Navigator, and Export Preview.
* **High-Precision Decimal Inputs:** Supports fractional border widths (0.01 - 10 mm/px) with dynamic unit-aware decimal steps (0.05 mm, 0.01 in/cm, 1 px).
* **Continuous Sub-Pixel Rasterization in Rust:** Pure Rust export engine uses `compute_rect_border_alpha` to compute exact sub-pixel geometric coverage, ensuring smooth anti-aliased hairline borders in 300 DPI exports.

---

### 📦 Checksums & Assets
* **macOS Apple Silicon / Universal Installer:** `OpenSmartAlbum_1.4.0_aarch64.dmg`
