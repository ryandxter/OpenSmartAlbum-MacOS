---
last_mapped_commit: a7d32d2e29106b6263ac48059f328f6de747f7b8
last_mapped_at: 2026-09-21
---
# Technical Debt, Architectural Concerns, and Systemic Limitations

**Analysis Date:** 2026-09-21  
**Target Codebase:** AFSNSmartAlbum (v1.0.77)  
**Stack:** Tauri 2 (`tauri` 2.11.3, `tauri-build` 2.6.3), Rust (2021 edition), React 18.3, Konva 9.3 / react-konva 18.2, Zustand 5.0, SQLite (`rusqlite` 0.34 bundled), `image` crate 0.25, `fontdue` 0.9.

---

## Executive Summary & Risk Assessment

AFSNSmartAlbum is designed as a desktop photo album creation and layout tool inspired by Pixellu SmartAlbums and Adobe InDesign. While core domain operations (such as project persistence in `.afsn` files, SQLite-backed metadata caching, and hardware-accelerated Konva 2D canvas manipulation) are functional, the codebase exhibits critical architectural bottlenecks, platform imbalances, visual asset fragility, and structural limitations:

1. **Iconography Fragility:** Zero external or modular icon system. Over 180 inline `<svg>` elements are manually hardcoded into JSX components with disparate stroke widths, arbitrary bounding boxes, and unconfigurable colors. CSS background icons use hardcoded URL-encoded hex colors that cannot respond to theme changes.
2. **UI / Theming Rigidity & Desktop Ergonomics:** Fixed dark-mode design tokens in `src/styles/tokens.css` with zero theme-switching infrastructure. Monolithic components (notably `src/features/workspace/WorkspaceLayout.tsx` at 3,535 lines) lack professional desktop flexibility: panels have fixed widths (`300px`), cannot be detached, docked, or resized via splitters, and the inspector suffers from disruptive auto-scrolling on selection change.
3. **Platform Compatibility Imbalance (Windows vs. macOS):** The app is heavily biased toward Windows. System font enumeration (`src-tauri/src/commands/app_commands.rs`) queries the Windows Registry directly, returning an empty array on macOS. Native screen color picking calls Win32 GDI APIs (`user32.dll`, `gdi32.dll`), returning `#FFFFFF` on macOS. Font fallback relies on Windows DOS 8.3 filenames (`timesbd.ttf`, `georgiaz.ttf`). Tauri bundling is configured exclusively for `"nsis"` (`src-tauri/tauri.conf.json`), omitting macOS DMG/APP targets, hardened runtime entitlements, and notarization scripts.
4. **The "libvips" Discrepancy:** The user interface (`src/features/export/ExportAlbumDialog.tsx`), `ARCHITECTURE.md`, and `ROADMAP.md` explicitly claim a multi-threaded libvips image engine. In reality, `Cargo.toml` contains no libvips bindings; all processing is executed by the pure-Rust `image` crate. Introducing genuine libvips dynamic loading on macOS introduces significant packaging hurdles (Homebrew arm64 vs. x86_64 dylibs, `@rpath` rewriting, and Gatekeeper notarization).
5. **Rigid Physical Spread Math:** Spreads are strictly hardcoded as binary layflat spreads (`leftPage` and `rightPage`), with total width enforced as `2 * pageWidth`. This architecture cannot accommodate multi-panel digital layouts (such as 3–10 panel Instagram swipe carousels, TikTok panoramas, accordion folds, or single-page products).
6. **Frame & Shape Limitations:** Elements are strictly rectangular with basic corner rounding (`PhotoFrameElement.cornerRadius`). There is no vector shape engine, no clipping path support (Canva-style hexagons, scallops, polygons), and no complex borders. The Rust export engine (`src-tauri/src/export_engine/mod.rs`) composites pixels via custom CPU loops that cannot parse vector paths without a dedicated 2D graphics library (e.g., `tiny-skia`).
7. **Export Format Bottlenecks:** Export is limited to flattened PNG, JPEG, and a handwritten ASCII PDF-1.4 wrapper around full-page DCTDecode JPEGs. There is no vector text in PDFs, no CMYK or ICC color profile embedding, and no layered format support (PSD, TIFF, or SVG).
8. **Unresolved Systemic Findings from Prior Audits:** Persistent risks in photo lifecycle (uncoordinated cache deletion, filename collisions on relink), project persistence (lack of OS file locks, cross-resource publication gaps), and typography (canvas vs. export glyph rendering divergence, missing HarfBuzz text shaping, styled ranges loss).

---

## 1. Iconography Architecture & Deficits

### 1.1 Current State: Absence of Icon System and Proliferation of Inline SVGs

The codebase does not utilize an icon library (such as `lucide-react`, `@heroicons/react`, or `react-icons`). A search across the repository confirms:

- **Zero `.svg` files** exist in `src/assets/`, `public/`, or any subfolder.
- **Over 180 occurrences of inline `<svg>` blocks** are scattered directly within React component render methods across 28 separate files.
- `src/components/ui/IconButton.tsx` merely accepts arbitrary `children: React.ReactNode` without enforcing any icon specifications, dimensions, stroke widths, or viewBox guidelines.

### 1.2 Inconsistent Stroke Widths, Dimensions, and ViewBoxes

Because icons were copied ad-hoc during feature development, icon geometry varies wildly without design token adherence:

- In `src/features/editor/FrameToolbar.tsx`:
  - Reset Ratio: `<svg width="15" height="15" viewBox="0 0 24 24" strokeWidth="2.5">` (line 74)
  - Fit Height: `<svg width="15" height="15" viewBox="0 0 24 24" strokeWidth="2.2">` (line 89)
  - Swap Photos: `<svg width="15" height="15" viewBox="0 0 24 24" strokeWidth="2.0">` (line 156)
  - Zoom Slider: `<svg width="16" height="16" viewBox="0 0 24 24" strokeWidth="1.8">` (line 247)
- In `src/features/settings/SettingsDialog.tsx`:
  - Tab navigation icons vary between `width="18" height="18"` (line 767) and `width="17" height="17"` (line 873).
  - Status badges use `width="13" height="13"` (line 961), `width="14" height="14"` (line 1013), and `width="32" height="32"` (line 1521).
  - Stroke widths range between `1.5`, `1.8`, `2.0`, and `2.5`.
- In `src/components/ui/Dialog.tsx`:
  - Close button uses a `viewBox="0 0 16 16"` coordinate system with `fill="none"` (line 75), unlike the standard `0 0 24 24` used elsewhere.

### 1.3 CSS Background Data URI Hardcoding

In CSS Modules, select dropdown arrows and unit toggles are embedded as URL-encoded data URIs with hardcoded hex colors:

- `src/components/ui/Select.module.css` (line 28):
  ```css
  background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="%23808080"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>');
  ```
- `src/components/ui/UnitInput.module.css` (line 71):
  ```css
  background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="%23808080"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>');
  ```
These hardcoded strokes (`%23808080` = `#808080`) cannot consume CSS custom properties (variables), meaning they cannot adapt if a light theme or high-contrast mode is applied.

### 1.4 Technical Debt & Maintenance Impact

- **Bundle Bloat:** Hundreds of lines of redundant SVG path strings are duplicated across compiled JS chunks instead of sharing optimized SVG symbols or unified component wrappers.
- **Visual Inconsistency:** Neighboring buttons in toolbars display visually discordant line weights (e.g., a `2.5` stroke icon next to a `1.8` stroke icon).
- **Accessibility Deficit:** Most inline SVGs lack `aria-hidden="true"` or corresponding `<title>` elements, causing screen readers to either skip or announce garbled vector elements.

---

## 2. UI / Theming & Desktop Ergonomics Deficits

### 2.1 Rigid Theme Variables & Hardcoded Dark Mode

The styling system defined in `src/styles/tokens.css` enforces dark mode globally:

```css
:root {
  color-scheme: dark;
  --color-bg-primary: #1a1a1e;
  --color-bg-secondary: #222226;
  --color-bg-tertiary: #2a2a2e;
  --color-surface: #303036;
  --color-border: #3a3a40;
  --color-text-primary: #e8e8ec;
  --color-text-secondary: #a0a0a8;
  --color-text-muted: #6a6a72;
  --color-accent: #38bdf8;
  ...
}
```

- **Zero Theme Switching Support:** There are no classes or attributes (e.g., `[data-theme="light"]`) to invert tokens.
- **No System Preference Response:** No `@media (prefers-color-scheme: light)` rules exist.
- **Hardcoded Colors in Components:** Multiple dialogs, canvas nodes, and overlays bypass CSS variables and use inline styles with hardcoded hex codes (e.g., `#18181b` in `src-tauri/tauri.conf.json:24`, `#1e293b` in `src/domain/text.ts:63`, `#22c55e` in `src/features/editor/KonvaEditorCanvas.tsx:1420`).

### 2.2 Monolithic Architecture of `WorkspaceLayout.tsx`

`src/features/workspace/WorkspaceLayout.tsx` has swelled to **3,535 lines of code** in a single file. It handles:

- Global keyboard navigation and shortcut routing.
- Canvas zoom, pan, and fit calculations.
- Properties Inspector state and tab switching (`properties`, `smart_layout`, `locks`).
- Filmstrip collapse and folder management.
- Frame alignment, distribution, dimension matching, rotation, and crop transformations.
- Undo/redo dispatching and autosave pipeline synchronization.
- Modal dialog orchestration (Settings, About, Relink, Export, Support).

This violation of Single Responsibility makes the primary workspace component fragile, difficult to test, and prone to re-render thrashing across the entire application.

### 2.3 Ergonomics Gaps Compared to Adobe InDesign & Lightroom

Professional desktop publishing and photography tools (InDesign, Lightroom Classic) provide highly flexible workspace ergonomics that AFSNSmartAlbum currently lacks:

- **Rigid Panel Widths:** The right inspector panel (`.rightPanel` in `src/features/workspace/WorkspaceLayout.module.css:362`) is fixed at `width: 300px`. Users cannot drag a splitter to expand or contract property controls. On high-resolution displays (4K/5K), 300px results in cramped number inputs; on small laptop screens (1366x768), 300px consumes nearly 25% of horizontal canvas space.
- **No Docking, Detaching, or Floating Palettes:** Panels cannot be unpinned, converted to floating windows, moved to secondary monitors, or organized into vertical icon strips.
- **Disorienting Auto-Scroll on Selection:** `src/features/workspace/WorkspaceLayout.tsx` (lines 139–149) contains an explicit `useEffect` that forcibly auto-scrolls the inspector panel to the top every time a user clicks a frame:
  ```typescript
  useEffect(() => {
    if (selectedFrameIds.length > 0 && inspectorTab === 'properties') {
      const timer = setTimeout(() => {
        if (propertyListRef.current) {
          propertyListRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [selectedFrameIds, inspectorTab]);
  ```
  If a user is adjusting corner radius, opacity, or borders at the bottom of the inspector and switches between two adjacent frames to match values, the panel forcibly jumps to the top, breaking user focus.
- **Fixed Bottom Filmstrip:** The photo tray is locked to the bottom grid area (`grid-area: filmstrip`). It cannot be docked vertically on the left or right, a common layout for ultra-wide monitors.

---

## 3. Platform Compatibility & Cross-Platform Gaps (Windows vs. macOS)

### 3.1 Windows-Specific APIs and Non-Windows Stubs

The backend contains native code paths that function exclusively on Windows, leaving macOS and Linux with inert stubs:

#### A. Screen Color Picker (`sample_screen_color`)

In `src-tauri/src/commands/app_commands.rs` (lines 95–156):

- On Windows, it invokes Win32 `GetDC(NULL)`, `GetCursorPos`, `GetPixel(hdc, x, y)`, and `ReleaseDC` from `user32.dll` and `gdi32.dll`.
- On non-Windows:
  ```rust
  #[cfg(not(target_os = "windows"))]
  {
      let _ = (x, y);
      Ok("#FFFFFF".to_string())
  }
  ```
  On macOS, clicking the color picker eyedropper on canvas or system UI **always returns `#FFFFFF` (pure white)** without sampling the screen.

#### B. System Font Enumeration (`get_system_fonts`)

In `src-tauri/src/commands/app_commands.rs` (lines 167–302):

- On Windows, it traverses the Windows Registry (`HKEY_LOCAL_MACHINE` and `HKEY_CURRENT_USER` under `SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts`) using `RegOpenKeyExW` and `RegEnumValueW`.
- On non-Windows:
  ```rust
  #[cfg(not(target_os = "windows"))]
  {
      Ok(Vec::new())
  }
  ```
  On macOS, `get_system_fonts()` returns an **empty vector**. The frontend font dropdowns cannot enumerate fonts installed in `/System/Library/Fonts` or `~/Library/Fonts`.

#### C. System Font Resolution for Text Rasterization

In `src-tauri/src/export_engine/text_rasterizer.rs` (lines 248–318):

- Font lookup checks `get_cached_system_fonts()`, which relies on `get_system_fonts()`. Because this returns empty on macOS, step 1 (exact registry resolution) fails completely.
- Step 2 falls back to hardcoded DOS 8.3 filenames (`src-tauri/src/export_engine/text_rasterizer.rs:320–450`):
  - Century Gothic: `gothicbi.ttf`, `gothicb.ttf`, `gothic.ttf`
  - Palatino: `palabi.ttf`, `antquabi.ttf`, `pala.ttf`, `bkant.ttf`
  - Garamond: `garabd.ttf`, `garait.ttf`, `gara.ttf`
  - Georgia: `georgiaz.ttf`, `georgiab.ttf`, `georgia.ttf`
  - Times New Roman: `timesbi.ttf`, `timesbd.ttf`, `times.ttf`
  - Segoe Script: `segoescb.ttf`, `segoesc.ttf`
  - Calibri: `calibriz.ttf`, `calibrib.ttf`, `calibri.ttf`
  - Cambria: `cambriaz.ttf`, `cambriab.ttf`, `cambria.ttc`
  None of these Windows font filenames exist on macOS. On macOS, system fonts are packaged as `.ttc` (TrueType Collections) or `.dfont` with names like `Helvetica.ttc`, `Times.ttc`, or `SF-Pro.ttf`. If a user selects any font outside the 6 bundled open-source fonts (`bundled_fonts.rs`), **text export on macOS fails silently, emitting blank text boxes**.

#### D. Case-Insensitive Path Comparisons on APFS/HFS+

In `src-tauri/src/db/package_io.rs` (lines 61–76) and `src-tauri/src/commands/photo_commands.rs` (lines 204–211):

```rust
// package_io.rs:
fn same_path(a: &str, b: &str) -> bool {
    let (a, b) = (normalized(a), normalized(b));
    if cfg!(windows) {
        a.to_string_lossy().eq_ignore_ascii_case(&b.to_string_lossy())
    } else { a == b }
}

// photo_commands.rs:
fn path_identity(path: &Path) -> String {
    let path = std::fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
    let value = path.to_string_lossy().replace('\\', "/");
    #[cfg(windows)]
    { value.trim_start_matches("//?/").to_lowercase() }
    #[cfg(not(windows))]
    { value }
}
```

**Fatal Flaw on macOS:** macOS filesystems (APFS and HFS+) are case-insensitive and case-preserving by default. Comparing paths with `a == b` or keeping case in `path_identity` means `/Users/chiio/Album/Project.afsn` and `/Users/chiio/album/project.afsn` are evaluated as **distinct files**. This causes:

- Failure to detect duplicate photo imports with different case casing.
- Failure to release database file locks or reconcile document identities in `package_io.rs`.

### 3.2 Packaging, Entitlements, and Notarization Deficits

In `src-tauri/tauri.conf.json`:

- **Targets:** Lines 38: `"targets": ["nsis"]`. Only Windows NSIS installers are configured. There is no DMG, `.app`, or universal binary target for macOS.
- **Missing Entitlements:** Tauri 2 on macOS requires an `Entitlements.plist` file with hardened runtime configurations (`com.apple.security.cs.allow-jit`, `com.apple.security.files.user-selected.read-write`, etc.) to permit reading user photo libraries from external drives.
- **Notarization Pipeline:** Zero notarization scripts (`xcrun notarytool`) or keychain configurations exist. Unsigned and un-notarized macOS builds will be blocked immediately by Apple Gatekeeper on macOS Sequoia/Sonoma.

### 3.3 The "libvips" Reality vs. Documentation

Documentation throughout the repository (`ARCHITECTURE.md`, `ROADMAP.md`, `AGENTS.md`) and UI text (`ExportAlbumDialog.tsx:661`: *"Unsharp masking tailored for photo paper (libvips)"*) states that the app uses a libvips image engine.

- **The Reality:** `Cargo.toml` links `image = { version = "0.25", ... }`. `libvips` is not in `Cargo.toml`, nor is `libvips-sys` or `libvips-rust`. The active pipeline is pure-Rust single/double-threaded CPU decoding using the `image` crate.
- **Hurdles to True libvips Integration on macOS:**
  1. **Dual Architecture Paths:** On Apple Silicon (`arm64`), Homebrew places libvips in `/opt/homebrew/lib/libvips.42.dylib`. On Intel (`x86_64`), it is placed in `/usr/local/lib/libvips.42.dylib`.
  2. **Bundled Transitive Dependencies:** libvips depends on GLib, GObject, libjpeg-turbo, libpng, libtiff, Little-CMS2, and Expat. In a standalone `.app`, these must be bundled inside `Contents/Frameworks/` with `@rpath` rewriting (`install_name_tool`).
  3. **Code Signing:** Every bundled `.dylib` must be individually signed with an Apple Developer ID certificate to pass notarization.

---

## 4. Page & Spread Constraints: Physical Layflat vs. Multi-Panel Carousels

### 4.1 Hardcoded Binary Layflat Spread Model

The domain model in `src/domain/album.ts` models an album spread as strictly two facing pages:

```typescript
export interface Spread {
  id: string;
  spreadIndex: number;
  type: SpreadType; // 'cover' | 'interior'
  name: string;
  leftPage: Page | null;
  rightPage: Page | null;
  gutterWidth: number;
  gutterUnit: Unit;
  ...
}
```

In `src/features/editor/KonvaEditorCanvas.tsx` (lines 1930–1944):

```typescript
const singlePageW = dims.pageWidth;
const singlePageH = dims.pageHeight;
const gutterPhysicalW = 0; // Pure layflat spread (strictly 2 * singlePageW)

// Total spread physical dimensions (strictly 2 * singlePageW)
const totalSpreadPhysicalW = singlePageW * 2;
const totalSpreadPhysicalH = singlePageH;
```

This assumption permeates every subsystem:

- **Canvas Rendering:** `KonvaEditorCanvas.tsx` calculates center spine snapping and split guides at exactly `x = singlePageW`.
- **Adaptive Layout Engine:** `src/domain/adaptiveLayout.ts` partitions element arrangements across the spine line (`totalSpreadPhysicalW / 2`).
- **Templates:** `src/features/templates/` templates are structured around `leftPage` and `rightPage` slots.
- **Page Navigator:** `src/features/album/PageNavigator.tsx` renders dual-page thumbnails.
- **Export Engine:** `src-tauri/src/export_engine/mod.rs` (lines 201–207) calculates split pages by halving the total width:
  ```rust
  let right_page_start_x = if spread.r#type == "cover" {
      (canvas_w as f64 / 2.0).round() as u32
  } else {
      (canvas_w as f64 / 2.0).round() as u32
  };
  ```

### 4.2 Inability to Support Social Media Carousels & Digital Formats

Modern photographers and digital creators require continuous multi-panel layouts:

1. **Instagram Swipeable Carousels:** A single seamless panorama cut into 3, 4, 5, or 10 continuous square (1:1) or portrait (4:5 / 1080x1350 px) slides.
2. **TikTok / Pinterest Multi-Panels:** 9:16 vertical sequences.
3. **Accordion & Tri-Fold Brochures:** 3-panel and 6-panel folding prints with asymmetric flap dimensions.
4. **Single-Page Books:** Portfolios where each page is an independent entity rather than facing pages.

**Current Architectural Blockers:**

- `Spread` cannot hold an arbitrary array of `pages: Page[]` (e.g. `pages.length === 5` for a 5-panel carousel).
- Elements cannot be cleanly sliced across N panel seams during export; export only supports full spread or binary 2-page split (`split_pages = true`).
- Aspect ratio is globally locked to the project’s album dimensions (`project.pageWidth` / `project.pageHeight`); different spreads cannot maintain variable aspect ratios or panel counts.

---

## 5. Frame & Transform Shape Limitations vs. Modern Creative Canvases

### 5.1 Rectangular Bounding Boxes and Basic Corner Radius

In `src/domain/editor.ts`, frame geometry is defined as:

```typescript
export interface PhotoFrameElement {
  id: string;
  type: 'photo';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  borderEnabled: boolean;
  borderWidth: number;
  borderColor: string;
  cornerRadius?: number | [number, number, number, number];
  ...
}
```

Every frame in the workspace is structurally a rectangle. The only morphological transformation supported is corner rounding (`cornerRadiusTl`, `cornerRadiusTr`, `cornerRadiusBr`, `cornerRadiusBl`).

### 5.2 Absence of Canva-Style Vector Shapes & Clipping Masks

Modern layout tools (Canva, InDesign, Figma) allow arbitrary shape containers:

- **Geometric Polygons:** Hexagons, octagons, triangles, diamonds, stars, badges.
- **Organic & Decorative Shapes:** Scalloped edges, archways, circles/ellipses, wavy borders, torn paper edges.
- **Vector Clipping Paths:** Using arbitrary SVG `<path>` definitions as photo clipping masks.
- **Compound Masks:** Combining text glyphs or multi-shape groups to clip underlying photos.

### 5.3 Export Engine Pixel Loop Bottleneck

Even if Konva on the frontend were upgraded to render SVG paths using `Konva.Path` or `Konva.Group({ clipFunc })`, the Rust export engine would be completely unable to render them.

In `src-tauri/src/export_engine/mod.rs` (lines 565–670), clipping is implemented via manual CPU subpixel distance calculations:

```rust
let compute_corner_alpha = |x: f64, y: f64, w: f64, h: f64, rtl: f64, rtr: f64, rbr: f64, rbl: f64| -> f64 {
    // Top-Left corner circle distance
    if rtl > 0.5 && x < rtl && y < rtl {
        let dx = x - rtl;
        let dy = y - rtl;
        let d = (dx * dx + dy * dy).sqrt();
        return (rtl + 0.5 - d).clamp(0.0, 1.0);
    }
    // Repeated for TR, BR, BL...
    1.0
};

for fy in 0..render_h {
    for fx in 0..render_w {
        let corner_alpha = if has_corner_radius { compute_corner_alpha(...) } else { 1.0 };
        ...
    }
}
```

**The Problem:** The export engine contains no general 2D path rasterization library (such as `tiny-skia` or `skia-safe`). It cannot evaluate Bézier curves, non-zero winding rules, or polygon point-in-polygon tests. Adding Canva-style shapes requires either:

1. Rewriting the export renderer to use a vector rasterizer (e.g. `tiny-skia`).
2. Adopting a headless browser/canvas renderer for export parity.

### 5.4 Complex Border Deficits

Frame borders are limited to solid color outlines (`elem.border_width`, `elem.border_color`). The engine lacks:

- Dashed or dotted stroke patterns.
- Double/triple decorative photo frame borders.
- Passe-partout (matting) margins with bevels or shadow drops.
- Gradient or textured border fills.

---

## 6. Export Capabilities: Missing Formats & Pipeline Bottlenecks

### 6.1 Flattened Raster Formats Only

In `src/features/export/ExportAlbumDialog.tsx` (line 13) and `src-tauri/src/export_engine/mod.rs` (line 14), format selection is constrained to:

```rust
pub format: String, // "jpeg", "png", "pdf"
```

### 6.2 Naive Handwritten PDF Generation

In `src-tauri/src/export_engine/mod.rs` (lines 1186–1275), PDF output is assembled by manually concatenating raw ASCII bytes and embedding JPEG byte streams:

```rust
pdf_data.extend_from_slice(b"%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
pdf_data.extend_from_slice(b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
...
let img_header = format!(
    "{} 0 obj\n<< /Type /XObject /Subtype /Image /Width {} /Height {} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length {} >>\nstream\n",
    img_obj_num, width, height, raw_jpeg.len()
);
pdf_data.extend_from_slice(img_header.as_bytes());
pdf_data.extend_from_slice(&raw_jpeg);
pdf_data.extend_from_slice(b"\nendstream\nendobj\n");
```

**Deficiencies of Current PDF Implementation:**

1. **Zero Vector Text:** All text elements are rasterized into the bitmap before PDF creation. Text in the exported PDF cannot be selected, copied, searched, or scaled without pixelation.
2. **No PDF/X Standards Compliance:** Professional commercial printing presses (e.g. Blurb, GraphiStudio, Zno) require PDF/X-1a:2001 or PDF/X-4 compliance. The custom PDF writer generates non-compliant, bare-bones PDF-1.4 files.
3. **No Page Box Metrics:** Missing `TrimBox`, `BleedBox`, `ArtBox`, and `MediaBox` definitions required for automated imposition software.

### 6.3 Complete Lack of Layered & Interchange Formats

Professional album workflows frequently require round-tripping into post-processing software:

- **Layered PSD (Adobe Photoshop):** Not supported. Photographers cannot export layered Photoshop files where background, photo frames (with layer masks), and text remain on discrete layers for manual retouching.
- **Layered TIFF:** Not supported.
- **InDesign IDML / Interchange:** Not supported. Layouts cannot be migrated to InDesign.
- **Multi-Page SVG:** Not supported.

### 6.4 Color Management Void (RGB vs. CMYK & ICC Profiles)

The export engine operates exclusively in 8-bit sRGB (`image::RgbaImage`).

- **No CMYK Support:** Commercial offset and digital presses require CMYK separation (e.g., US Sheetfed Coated, Euroscale, Japan Color).
- **No ICC Profile Tagging:** The PNG chunk encoder (`encode_png_with_dpi`) writes `pHYs` chunks for DPI resolution, but does not embed `iCCP` or `sRGB` profile chunks. Exported images opened in strict color-managed viewers may display shifted colors.

### 6.5 Memory Pressure and Concurrency Risks During High-Res Batch Export

During a 300 DPI export of an album containing 40 spreads and 300 photos:

- Each master photo is decoded at full resolution using `image::open`. A 50-megapixel camera RAW/JPEG decodes to ~200 MB of uncompressed RGBA in RAM.
- While spreads are processed in parallel via Rayon (`src-tauri/src/commands/export_commands.rs:344–350`), memory usage can rapidly exceed 4–8 GB, risking out-of-memory (OOM) crashes on low-spec client machines.
- There is no dynamic downsampling decoder (e.g. libjpeg-turbo DCT scaling or libvips shrink-on-load) to downscale images during decode.

---

## 7. Synthesis of Prior Audits: Unresolved Technical Debt

### 7.1 Photo Lifecycle Fragilities (`PHOTO_LIFECYCLE_AUDIT.md`)

- **F1 / F7 (Selection Invalidation during Deletion):** `ConfirmDialog` renders via a React portal to the document `<body>`. The outside-click listener in `FilmstripTray.tsx` deselects all photos upon clicking dialog action buttons, causing batch delete calls to fail silently unless target IDs are captured prior to click.
- **F2 (Optimistic Mutations without Rollback):** Single and batch photo deletion unbinds frame elements and removes photo records before backend persistence confirms success. If disk I/O or SQLite operations fail, canvas frames are left permanently blank without recovery.
- **F3 (Unsaved Status Divergence):** Deleting library photos does not flag `saveStatus = 'unsaved'` in the project store. Users can close the app without prompt, losing library state. Old undo snapshots retain dangling photo references.
- **F4 (Filename-Based Collisions):** Photo uniqueness and automatic folder relinking rely on file basenames rather than canonical content hashes or invariant UUIDs. Photos with identical names (e.g. `IMG_0001.JPG`) from different cameras or cards overwrite or collide during relinking.
- **F6 (Uncoordinated Cache Deletion):** Photo deletion executes a recursive sweep of `$APPCACHE/thumbnails` and `$APPCACHE/previews`, deleting active `.tmp` files currently being written by background import workers.

### 7.2 Project Persistence Fragilities (`PROJECT_PERSISTENCE_AUDIT.md`)

- **Zip / AFSN Duality:** Legacy projects stored directly inside ZIP archives were previously truncated on autosave. While `.afsn` is now the sole working format, archive extraction still requires external directory management.
- **Lack of Operating System File Locks:** Document identity checks (SQLite migration v14) verify document UUIDs, but provide no OS-level advisory or mandatory file lock (`flock` / `LockFileEx`). Concurrent edits by two application instances or cloud sync clients (Dropbox/Google Drive) can clobber project states.
- **Non-Atomic Dual-Resource Publication:** Saving writes the `.afsn` JSON file to disk and commits metadata to SQLite. Because SQLite and the filesystem cannot participate in a two-phase commit (2PC), a failure during SQLite update after file write leaves the database out of sync with the document on disk.

### 7.3 Typography & Text Handling Fragilities (`TEXT_HANDLING_AUDIT.md`)

- **P1: Styled Ranges Loss on Hydration:** `src/stores/albumStore.ts:151` ignores `styledRanges` during `loadAlbumFromDb`. Rich text styling (bold, italic, colors per word) is permanently stripped whenever an album is saved and re-opened.
- **P1: Inch Unit Clamping Bug:** Plain text size conversion in `src/domain/units.ts:99` clamps values to 1 pt before scaling by 10, causing 24 pt text in an inch-based album to display visually as 72 pt text.
- **P1: Add Text Off-Canvas Placement:** New text nodes default to `Math.max(10, ...)` project units (`src/stores/editorStore.ts:450–502`). On an 8-inch or 8-cm album, new text is placed at 10 inches or 10 cm, rendering it completely outside the visible page boundary.
- **P1: Typography Parity Void:** Canvas relies on browser text layout and Google Fonts; export rasterization uses `fontdue` in Rust. Because Rust rasterization lacks HarfBuzz text shaping, ligature substitution, and kerning pairs, and because emoji character indexing diverges between JavaScript UTF-16 and Rust `Vec<char>`, exported typography visually differs from canvas layout.
- **P2: Frame Auto-Expansion Fighting Manual Resizing:** `src/features/editor/TextNode.tsx` runs an auto-fit effect that overrides user-defined frame heights, preventing fixed-height text boxes or overset text indicators.

---

## 8. Prioritized Technical Debt Matrix & Remediation Roadmap

The table below classifies the identified technical debts by severity, blast radius, and remediation complexity.

| ID | Category | Issue Description | Severity | Blast Radius | Remediation Complexity |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **D1** | Platform | Windows Registry dependency (`get_system_fonts`) leaves macOS with 0 fonts | **P1 (Critical)** | Typography, Export | Medium (Integrate `font-kit` / CoreText) |
| **D2** | Platform | Eyedropper (`sample_screen_color`) uses Win32 GDI, returns `#FFFFFF` on macOS | **P1 (Critical)** | Color Tools, UI | Low (Implement macOS `NSColorSampler` via objc) |
| **D3** | Platform | Case-sensitive `same_path` / `path_identity` fails on macOS APFS/HFS+ | **P1 (Critical)** | Photo Library, Relink | Low (Use `.to_lowercase()` or filesystem canonicalization) |
| **D4** | Export | Handwritten ASCII PDF-1.4 embeds only raster JPEGs; no vector text, no CMYK | **P1 (Critical)** | Export, Production | High (Integrate `printpdf` or `lopdf` with vector text) |
| **D5** | Domain | Rigid layflat binary spread math prevents multi-panel carousels and single pages | **P2 (High)** | Canvas, Layout, Export | High (Refactor `Spread` to hold `pages: Page[]`) |
| **D6** | Architecture | Monolithic `WorkspaceLayout.tsx` (3,535 lines) creates performance and state risk | **P2 (High)** | UI, Maintainability | Medium (Decompose into modular toolbars, docks, inspectors) |
| **D7** | Export | Rust export engine uses manual CPU pixel loop; cannot render vector shapes | **P2 (High)** | Frames, Shapes, Export | High (Integrate `tiny-skia` for 2D path rendering) |
| **D8** | UI / Theming | Over 180 hardcoded inline SVGs; no unified icon system (`lucide-react`) | **P2 (High)** | Design System, UI | Medium (Migrate to `lucide-react` with standard icon tokens) |
| **D9** | UI / Theming | Fixed 300px non-resizable right panel; auto-scroll disorientation on selection | **P2 (High)** | Desktop Ergonomics | Low (Add resizable splitters; remove disruptive auto-scroll) |
| **D10**| Platform | No macOS bundle, entitlements, or notarization in `tauri.conf.json` | **P2 (High)** | Distribution, CI/CD | Medium (Configure bundle targets, signing, and entitlements) |
| **D11**| Architecture | Documentation and UI claim libvips; codebase actually uses `image` crate | **P3 (Medium)** | Architecture, Performance | High (Decide between genuine libvips bundling or honest branding) |
| **D12**| Export | Zero layered export formats (no PSD, TIFF, or SVG) | **P3 (Medium)** | Professional Workflow | High (Implement layered PSD / TIFF generation) |

---

## 9. Architectural Recommendations

1. **Adopt a Standardized Icon System:**
   - Install and standardize on `lucide-react`. Replace all 180+ inline SVGs with standard Lucide icon components.
   - Standardize icon sizes: `14px` (dense/micro), `16px` (standard toolbar), `20px` (headers/dialogs).
   - Enforce `strokeWidth={2}` across the application.
   - Replace CSS background SVG data URIs with CSS-mask icons or styled button triggers.

2. **Refactor UI / Theming & Desktop Ergonomics:**
   - Decompose `WorkspaceLayout.tsx` into decoupled subcomponents (`WorkspaceToolbar`, `InspectorDock`, `CanvasViewport`, `FilmstripDock`).
   - Implement resizable panel splitters using CSS drag handlers or lightweight splitter libraries, persisting width preferences in `appPreferences`.
   - Remove the disruptive `propertyListRef.current.scrollTo({ top: 0 })` selection hook.
   - Build a theme provider with support for Light, Dark, and System modes using CSS variable inversion.

3. **Achieve True Cross-Platform Parity for macOS:**
   - Replace Win32 registry calls with the cross-platform `font-kit` crate or macOS CoreText bindings to discover system fonts across `/System/Library/Fonts` and `~/Library/Fonts`.
   - Implement native macOS screen color sampling via `NSColorSampler` using the `objc2` or `cocoa` crate.
   - Normalize file paths with case-insensitivity on macOS and Windows alike.
   - Update `tauri.conf.json` to include `"targets": ["nsis", "dmg", "app"]`, establish hardened runtime entitlements, and automate `notarytool` signing.

4. **Modernize Spread & Frame Data Models:**
   - Evolve `Spread` from `{ leftPage: Page | null, rightPage: Page | null }` to `{ pages: Page[], layoutMode: 'spread' | 'carousel' | 'single' }`. This unlocks 3–10 panel Instagram carousels, accordion folds, and multi-page formats.
   - Expand `PhotoFrameElement` to support a `shape` field (`{ type: 'rectangle' | 'circle' | 'polygon' | 'svg_path', pathData?: string }`).
   - Integrate `tiny-skia` into `src-tauri/src/export_engine/mod.rs` to replace manual pixel-by-pixel clipping loops with a hardware-grade 2D software rasterizer capable of anti-aliased Bézier paths, polygons, and complex borders.

5. **Upgrade the Export Pipeline:**
   - Transition PDF export from handwritten ASCII byte strings to a standards-compliant PDF library (e.g., `printpdf`), enabling genuine vector text embedding, PDF/X compliance, and bleed box metadata.
   - Add support for ICC color profile embedding in JPEG and PNG exports.
   - Plan a roadmap for layered PSD export using the `psd` or custom PSD binary writers to satisfy professional retouching workflows.

---
*Document produced as part of codebase mapping for AFSNSmartAlbum. All rights reserved.*
