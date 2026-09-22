# Phase 5: Advanced Layered Export Suite — Technical Research

**Phase Target**: OSAM-05 Advanced Layered Export Suite  
**Document**: `05-RESEARCH.md`  
**Status**: Completed  
**Author**: gsd-phase5-researcher  
**Context & Scope**: Pure Rust, offline-only, zero cloud dependencies, high-performance prepress & social media export engine for OpenSmartAlbum macOS.

---

## 1. Executive Summary & Architecture Overview

Phase 5 elevates OpenSmartAlbum from a desktop layout editor into a professional prepress and social publishing studio. The target capabilities encompass four major export disciplines:
1. **EXPO-01 (Adobe Photoshop Layered PSD)**: Discrete raster layers for each photo frame, attached grayscale channel layer masks (`id = -2`) preserving non-rectangular clipping geometry (circles, hexagons, hearts, scallops, custom SVG), background layer, and anti-aliased text layers at project DPI.
2. **EXPO-02 (Instagram Carousel Multi-Slide Slicer)**: Continuous panoramic rendering of digital social layouts ($1080 \times 1080$, $1080 \times 1350$, $1080 \times 1920$), sliced into numbered high-resolution JPEGs (`slide_01.jpg`, `slide_02.jpg`, ..., `slide_N.jpg`) plus `full_panorama.jpg` in a dedicated timestamped folder.
3. **EXPO-03 (High-Bit-Depth Lossless TIFF)**: LZW/Deflate lossless compressed 8-bit and 16-bit RGB TIFF export with embedded prepress resolution tags (`ResolutionUnit = 2 (Inch)`, `XResolution = 300/1`, `YResolution = 300/1`).
4. **EXPO-04 (Print-Ready PDF/X with Bleed & Vector Marks)**: Multi-page PDF/X-compliant documents with defined `MediaBox`, `BleedBox`, and `TrimBox`, surrounded by vector trim/crop marks, center fold ticks, slug text info, and PDF/X output intent metadata.

### System Architectural Topology

```
                  ┌──────────────────────────────────────────────┐
                  │          Frontend: Export Dialog             │
                  │  (ExportAlbumDialog.tsx / Carousel Slices)   │
                  └──────────────────────┬───────────────────────┘
                                         │ Tauri Commands
                     ┌───────────────────┴───────────────────┐
                     ▼                                       ▼
       ┌───────────────────────────┐           ┌───────────────────────────┐
       │   export_album_high_res   │           │  export_carousel_slices   │
       │ (Print Spreads & Pages)   │           │  (Instagram Multi-Slide)  │
       └─────────────┬─────────────┘           └─────────────┬─────────────┘
                     │                                       │
     ┌───────────────┼───────────────┬──────────────┐        │
     ▼               ▼               ▼              ▼        ▼
┌─────────┐    ┌───────────┐   ┌───────────┐   ┌─────────┐ ┌──────────────┐
│  JPEG   │    │ Lossless  │   │  Layered  │   │ Print   │ │  Panoramic   │
│ & PNG   │    │   TIFF    │   │    PSD    │   │  PDF/X  │ │ Slicer Engine│
│(mod.rs) │    │(tiff crate│   │(psd_writer│   │(vector  │ │(mod.rs slice│
│         │    │  LZW/16b) │   │  masks)   │   │ marks)  │ │  generator)  │
└─────────┘    └───────────┘   └───────────┘   └─────────┘ └──────────────┘
```

---

## 2. EXPO-01: Adobe Photoshop (.psd) Specification & Serializer

### 2.1 PSD Binary File Format Specification

The Adobe Photoshop document format (`.psd`) is a big-endian binary format structured into 5 contiguous sections:

```
┌────────────────────────────────────────────────────────┐
│ 1. File Header (26 bytes)                              │
│    Signature '8BPS', Version 1, Channels, H, W, Depth  │
├────────────────────────────────────────────────────────┤
│ 2. Color Mode Data Section (4 bytes: 0 for RGB)        │
├────────────────────────────────────────────────────────┤
│ 3. Image Resources Section                             │
│    Blocks: ResolutionInfo (0x03ED) for DPI             │
├────────────────────────────────────────────────────────┤
│ 4. Layer and Mask Information Section                  │
│    Layer count, Layer records, Masks, Channel pixel data│
├────────────────────────────────────────────────────────┤
│ 5. Image Data Section (Merged Composite Image)         │
│    Planar RGB uncompressed or PackBits RLE             │
└────────────────────────────────────────────────────────┘
```

#### Section 1: Header (26 bytes)
- `[0..4]`: Signature `8BPS` (`0x38, 0x42, 0x50, 0x53`)
- `[4..6]`: Version `1` (`0x00, 0x01` big-endian)
- `[6..12]`: Reserved 6 bytes (all zeroes `0x00`)
- `[12..14]`: Channels count `3` (for RGB composite)
- `[14..18]`: Height in pixels (`u32` BE)
- `[18..22]`: Width in pixels (`u32` BE)
- `[22..24]`: Depth in bits per channel (`8` or `16`)
- `[24..26]`: Color Mode `3` (`RGBMode`)

#### Section 2: Color Mode Data
- For RGB mode, length is `0x00000000` (4 bytes).

#### Section 3: Image Resources Section
Contains Photoshop resource blocks tagged with `8BIM`. To guarantee professional 300 DPI display in Photoshop:
- Signature: `8BIM`
- Resource ID: `0x03ED` (ResolutionInfo)
- Name: Pascal string (empty `[0x00, 0x00]`)
- Data Size: `16` bytes (`0x00000010`)
- Data payload:
  - `hRes`: 32-bit fixed point $(DPI \ll 16)$ (e.g. $300 \ll 16 = 0x012C0000$)
  - `hResUnit`: `1` (pixels per inch)
  - `widthUnit`: `1` (inches)
  - `vRes`: 32-bit fixed point $(DPI \ll 16)$
  - `vResUnit`: `1` (pixels per inch)
  - `heightUnit`: `1` (inches)

#### Section 4: Layer and Mask Information Section
This is the core of EXPO-01.
1. **Section Length**: `u32` BE.
2. **Layer Info Block Length**: `u32` BE.
3. **Layer Count**: `i16` BE (positive integer = count of layers).
4. **Layer Records** (one per layer):
   - `top`, `left`, `bottom`, `right`: 4 $\times$ `i32` BE pixel bounds.
   - `channel_count`: `u16` BE.
     - For standard layer without mask: `4` channels (Red=0, Green=1, Blue=2, Alpha=-1).
     - For layer with non-rectangular shape mask: `5` channels (Red=0, Green=1, Blue=2, Alpha=-1, User Mask=-2).
   - `channel_info`: for each channel:
     - `channel_id`: `i16` BE (`0`=Red, `1`=Green, `2`=Blue, `-1`=Alpha/Transparency, `-2`=User Layer Mask).
     - `data_length`: `u32` BE (byte size of compressed or raw channel data including 2-byte compression header).
   - `blend_mode_sig`: `8BIM` (4 bytes).
   - `blend_mode_key`: `norm` (4 bytes) for Normal blend mode.
   - `opacity`: `u8` ($0 \dots 255$).
   - `clipping`: `0` (base).
   - `flags`: `0x08` (bit 3 set for Photoshop 5.0+ 8-bit compatibility, bit 1 = 0 visible).
   - `filler`: `0x00`.
   - `extra_data_length`: `u32` BE:
     - **Layer Mask Data**:
       - If no mask: 4 bytes length = `0` (`0x00000000`).
       - If mask present: 4 bytes length = `20` (`0x00000014`), followed by:
         - Mask `top`, `left`, `bottom`, `right`: 4 $\times$ `i32` BE (matching frame bounds).
         - Default color: `0` (black outside mask boundary).
         - Flags: `0x01` (bit 0 = position relative to layer).
         - Padding: 2 bytes (`0x00, 0x00`).
     - **Layer Blending Ranges**: 4 bytes length = `0` (`0x00000000`).
     - **Layer Name**: Pascal string (1 byte length + UTF-8 name bytes), padded with zeroes to a multiple of 4 bytes!
5. **Channel Image Data**:
   Immediately follows all Layer Records. Channels are ordered per layer exactly as declared in the layer records:
   - For each channel:
     - 2 bytes `compression`: `0` (Raw uncompressed) or `1` (RLE PackBits).
     - If PackBits (`1`):
       - Scanline byte counts table: $H \times 2$ bytes (`u16` BE for each row's compressed length).
       - Compressed PackBits stream for each row.
     - If Raw (`0`):
       - $W \times H$ raw byte stream.

#### Section 5: Merged Image Data (Composite)
- 2 bytes compression (`0` or `1`).
- Planar composite image data (Red plane, Green plane, Blue plane).

---

### 2.2 Crate Evaluation vs Pure Rust Serializer (`psd_writer.rs`)

| Option | Pros | Cons | Verdict |
| :--- | :--- | :--- | :--- |
| **`ag-psd` crate** (v0.3.0) | Full TypeScript feature port | **Incompatible**: Requires Rust $\ge 1.85.0$ (Edition 2024), breaks project's `rust-version = "1.77.2"`. Self-admitted "vibe-coded" AI port without line-by-line audit. | **Rejected** |
| **`psd` crate** (v0.3) | Clean reader | Parser only, has **no serializer/writer** functionality. | **Rejected** |
| **Custom `psd_writer.rs`** | Zero dependencies, 100% offline, exact spec compliance, full control over Layer Mask ID `-2`, PackBits RLE, and 300 DPI tags. Guaranteed stability on Rust 1.77.2+. | Requires writing ~350 lines of clean binary packing logic. | **RECOMMENDED** |

### 2.3 Layer & Mask Pipeline Implementation Details

In `psd_writer.rs`:
1. **PackBits RLE Compression**:
   PackBits is the native Apple/Adobe byte-run algorithm:
   - Run of identical bytes ($2 \dots 128$): emit `-(count - 1)` as `i8`, followed by the byte.
   - Run of literal non-repeated bytes ($1 \dots 128$): emit `(count - 1)` as `i8`, followed by literal bytes.
   - For each scanline row, compute compressed bytes and store the row length in the $H \times 2$ byte table.
2. **Channel Layer Masks for Non-Rectangular Shapes**:
   For any photo element with `shapeType` (`circle`, `oval`, `hexagon`, `octagon`, `star`, `scallop`, `heart`, or `cornerRadius > 0`):
   - The photo layer stores the native unclipped rectangular photo bitmap at $(frame\_w, frame\_h)$.
   - A grayscale mask image ($W \times H$) is generated:
     - Pixels inside the shape = `255` (fully visible).
     - Edge pixels with anti-aliasing = $(alpha \times 255.0)$.
     - Pixels outside = `0` (hidden).
   - This mask is written as Channel ID `-2`.
   - In Adobe Photoshop, this creates a linked Layer Mask! The user can adjust the mask in Photoshop or reveal the unclipped photo at any time.
3. **Text Layers**:
   Rasterized using the existing `text_rasterizer` at exact DPI with clean subpixel anti-aliasing, exported as discrete layers named `Text: [Snippet]`.

---

## 3. EXPO-02: Automated Multi-Slide Slice Exporter for Instagram Carousels

### 3.1 Digital Carousel Coordinates & Slicing Geometry

Social media carousels operate on continuous pixel grids:
- **Square 1:1**: $1080 \times 1080$ px per slide ($N$ slides $\implies (N \times 1080) \times 1080$ px).
- **Portrait 4:5**: $1080 \times 1350$ px per slide ($N$ slides $\implies (N \times 1080) \times 1350$ px).
- **Story/Reel 9:16**: $1080 \times 1920$ px per slide ($N$ slides $\implies (N \times 1080) \times 1920$ px).

Photos placed in the carousel stage can span seamlessly across slide boundaries (e.g. spanning from Slide 1 into Slide 2).

### 3.2 Exporter Workflow & Output Directory Structure

```
Output Root /
 └── [ProjectName]_Carousel_20260922_180000/
      ├── slide_01.jpg       (1080 x 1350, 92% JPEG sRGB)
      ├── slide_02.jpg       (1080 x 1350, 92% JPEG sRGB)
      ├── slide_03.jpg       (1080 x 1350, 92% JPEG sRGB)
      ├── slide_04.jpg       (1080 x 1350, 92% JPEG sRGB)
      ├── slide_05.jpg       (1080 x 1350, 92% JPEG sRGB)
      └── full_panorama.jpg  (5400 x 1350, stitched complete preview)
```

### 3.3 Slicing Pipeline

1. **Continuous Canvas Allocation**:
   Allocate `RgbaImage` of size $W_{total} = (N \times \text{slideWidthPx})$, $H = \text{slideHeightPx}$.
2. **Background Passes**:
   For each slide $i \in [0 \dots N-1]$, fill $[i \times \text{slideWidthPx} \dots (i+1) \times \text{slideWidthPx}]$ with `slide.backgroundColor`.
3. **Photo Element Composite**:
   Render photo elements on the continuous stage at their continuous $(x, y, w, h)$ positions with rotation, crop, and corner radius. Photos crossing slide borders are naturally and continuously drawn across the boundary without split artifacts.
4. **Slide Cropping & Slicing**:
   For $i = 0 \dots N-1$:
   - Crop sub-image from $x = i \times \text{slideWidthPx}$, width = $\text{slideWidthPx}$, height = $\text{slideHeightPx}$.
   - Apply unsharp print/display sharpening if enabled.
   - Encode using `encode_jpeg_with_dpi(..., quality = 92, dpi = 72)`.
   - Save atomically to `slide_{i+1:02}.jpg`.
5. **Panorama Generation**:
   Save full continuous canvas to `full_panorama.jpg`.
6. **Tauri Command**:
   `export_carousel_slices(app: AppHandle, payload: CarouselPayload, options: CarouselExportOptions) -> Result<CarouselExportResult, String>`.

---

## 4. EXPO-03: High-Bit-Depth Lossless TIFF Export

### 4.1 TIFF Specification & Tag Infrastructure

For professional photo labs and archival output, TIFF files must include:
1. **Lossless Compression**: LZW (Lempel-Ziv-Welch) or Deflate. LZW is universally supported by photographic prepress RIPs.
2. **DPI Resolution Tags**:
   - `ResolutionUnit` (Tag `296` / `0x0128`): `2` (`Inch`).
   - `XResolution` (Tag `282` / `0x011A`): Rational `(DPI, 1)`.
   - `YResolution` (Tag `283` / `0x011B`): Rational `(DPI, 1)`.
3. **Bit Depth**:
   - **8-bit RGB**: 3 channels $\times$ 8 bits = 24 bpp.
   - **16-bit RGB**: 3 channels $\times$ 16 bits = 48 bpp (converted via $(c \times 257)$ or native 16-bit image data).

### 4.2 Rust Implementation using `tiff` Crate

`image` crate (v0.25) in `src-tauri/Cargo.toml` already depends on `tiff`. Adding `tiff = { version = "0.11", default-features = false, features = ["lzw", "deflate"] }` enables low-level tag encoding:

```rust
use tiff::encoder::{TiffEncoder, ResolutionUnit, Rational, colortype};
use std::fs::File;
use std::path::Path;

pub fn encode_tiff_with_dpi(
    path: &Path,
    rgb_img: &image::RgbImage,
    dpi: u32,
    sixteen_bit: bool,
) -> Result<(), String> {
    let file = File::create(path).map_err(|e| e.to_string())?;
    let mut encoder = TiffEncoder::new(file).map_err(|e| e.to_string())?;
    
    let width = rgb_img.width();
    let height = rgb_img.height();

    if sixteen_bit {
        let mut img_encoder = encoder.new_image::<colortype::RGB16>(width, height)
            .map_err(|e| e.to_string())?;
        img_encoder.resolution_unit(ResolutionUnit::Inch).map_err(|e| e.to_string())?;
        img_encoder.x_resolution(Rational::from((dpi, 1))).map_err(|e| e.to_string())?;
        img_encoder.y_resolution(Rational::from((dpi, 1))).map_err(|e| e.to_string())?;
        
        let u16_data: Vec<u16> = rgb_img.pixels()
            .flat_map(|p| [p[0] as u16 * 257, p[1] as u16 * 257, p[2] as u16 * 257])
            .collect();
        img_encoder.write_data(&u16_data).map_err(|e| e.to_string())?;
    } else {
        let mut img_encoder = encoder.new_image::<colortype::RGB8>(width, height)
            .map_err(|e| e.to_string())?;
        img_encoder.resolution_unit(ResolutionUnit::Inch).map_err(|e| e.to_string())?;
        img_encoder.x_resolution(Rational::from((dpi, 1))).map_err(|e| e.to_string())?;
        img_encoder.y_resolution(Rational::from((dpi, 1))).map_err(|e| e.to_string())?;
        img_encoder.write_data(rgb_img.as_raw()).map_err(|e| e.to_string())?;
    }

    Ok(())
}
```

---

## 5. EXPO-04: Print-Ready PDF/X with Bleed, Slug, & Vector Trim Marks

### 5.1 PDF Box Geometry Model

In PDF prepress workflows, page boundaries are governed by 3 concentric boxes:

```
┌────────────────────────────────────────────────────────┐
│ MediaBox: Full sheet including slug & marks (e.g. +10mm│
│  ┌──────────────────────────────────────────────────┐  │
│  │ BleedBox: Image area with bleed (e.g. +3mm)      │  │
│  │  ┌────────────────────────────────────────────┐  │  │
│  │  │ TrimBox: Finished page boundary after cut  │  │  │
│  │  │                                            │  │  │
│  │  │            Page Content Area               │  │  │
│  │  │                                            │  │  │
│  │  └────────────────────────────────────────────┘  │  │
│  │  ▲ Corner Crop Marks (hairline 0.5pt outside)    │  │
│  └──────────────────────────────────────────────────┘  │
│  ▲ Slug Info: Project Name, Spread Number, Timestamp   │
└────────────────────────────────────────────────────────┘
```

1. **TrimBox**: Finished dimensions of the album page/spread (e.g. $200\text{mm} \times 200\text{mm}$).
2. **BleedBox**: Finished dimensions + bleed cut margins (e.g. $3\text{mm}$ bleed on all outer edges).
3. **MediaBox**: Total PDF canvas enclosing BleedBox + Slug area (e.g. $5\text{mm}$ / $14.17\text{pt}$ slug on all sides) where vector trim marks, spine ticks, and metadata labels reside.

### 5.2 Vector Crop & Fold Marks Stream

In pure PDF content stream syntax:
- Set hairline stroke: `0.5 w`
- Set stroke color to rich black / registration: `0 0 0 RG`
- **8 Corner Trim Marks**:
  Each corner has a horizontal and vertical line aligned with the trim edge, offset by $2\text{mm}$ ($5.67\text{pt}$) outside the trim line, extending for $4\text{mm}$ ($11.34\text{pt}$).
- **Spine Fold Marks (Center Ticks)**:
  For two-page facing spreads, draw vertical ticks at the top and bottom spine center (`x = center_x`) outside the trim line.
- **Slug Metadata**:
  Using PDF Type1 built-in font `/Helvetica`:
  `BT /F1 8 Tf 14 14 Td (Album: ProjectName | Spread 01 | 300 DPI | 2026-09-22) Tj ET`

### 5.3 PDF/X-3 Compliance Standards

To pass commercial preflight checks (Adobe Acrobat Preflight, Enfocus PitStop, Kodak Prinergy):
1. **OutputIntents Dictionary**:
   Catalog includes:
   ```pdf
   /OutputIntents [
     <<
       /Type /OutputIntent
       /S /GTS_PDFX
       /OutputConditionIdentifier (sRGB IEC61966-2.1)
       /RegistryName (http://www.color.org)
       /Info (sRGB IEC61966-2.1)
     >>
   ]
   ```
2. **Document Info Dictionary**:
   Trailer `/Info` contains:
   ```pdf
   <<
     /Title (...)
     /Creator (OpenSmartAlbum macOS)
     /GTS_PDFXVersion (PDF/X-3:2002)
   >>
   ```
3. **Box Hierarchy**:
   Every `/Page` dictionary explicitly specifies `/MediaBox`, `/BleedBox`, and `/TrimBox`.

---

## 6. Frontend UI Integration in `ExportAlbumDialog.tsx`

### 6.1 Format Grid Enhancement

Add `TIFF` and `PSD` to the format selection grid:
- **JPEG**: Standard Print Lab (existing)
- **PNG**: Lossless Graphic Precision (existing)
- **TIFF**: Prepress 16-bit Lossless Archival (new)
- **PDF**: Multi-Page Book / PDF/X Print-Ready (enhanced)
- **PSD**: Multi-Layer Photoshop Document with Shape Masks (new)

### 6.2 Context-Aware Option Panels

- When **TIFF** selected:
  - Bit depth toggle: `8-bit` vs `16-bit Lossless Deep Color`.
  - Compression toggle: `LZW Lossless` vs `Uncompressed`.
- When **PDF** selected:
  - Toggle: `PDF/X Print-Ready Mode`.
  - Slug margin slider: $3\text{mm} \dots 10\text{mm}$ (default $5\text{mm}$).
  - Vector crop/fold marks toggle (default ON).
- When **PSD** selected:
  - Informational badge: "Preserves discrete photo layers, shape clipping masks (non-destructive), background, and vector/raster text at 300 DPI."
- When `activeMode === 'carousel'`:
  - Dialog automatically adapts to **Instagram Carousel Slices Export**:
    - Number of slices, slide dimensions ($1080 \times 1080$ or $1080 \times 1350$).
    - Full panorama preview option.
    - JPEG quality slider (default 92%).

---

## 7. Pitfalls, Edge Cases & Verification Strategies

### 7.1 PSD Byte Alignment Rules
- **Pascal Strings**: In Photoshop Image Resources and Layer Records, Pascal strings must be padded with zeroes so that the total size (including the 1-byte length prefix) is an even number of bytes for image resources, and a **multiple of 4 bytes** for layer names!
- **Layer Mask Bounds**: When a layer mask is smaller or larger than the photo, the mask bounds in the layer mask record must match the exact pixel coordinates of the mask channel data.

### 7.2 Memory Consumption at 300 DPI
- A $24 \times 12$ inch spread at 300 DPI is $7200 \times 3600$ pixels = ~103 MB per RGBA buffer.
- When generating PSD with 10 photo layers, allocating 10 full-canvas buffers would consume >1 GB RAM.
- **Optimization Strategy**: Crop each photo layer buffer to its exact bounding box `(frame_w, frame_h)` in pixel coordinates, and store `(top, left, bottom, right)` in the layer record! Only the background layer and composite image need full-canvas dimensions.

### 7.3 Slicing Subpixel Alignment
- Carousel slide slicing must use integer pixel coordinates `(i * slide_width_px)` to prevent single-pixel seam artifacts between slides when uploaded to Instagram.

---

## 8. Recommended Atomic Implementation Plan

Following repository standards, Phase 5 decomposes into two focused, executable plans:

### Plan 05-01: Pure Rust Layered PSD Serializer & Instagram Carousel Slice Exporter
- **Scope**:
  1. Implement `src-tauri/src/export_engine/psd_writer.rs`:
     - Big-endian binary PSD encoder (Header, Resources 300 DPI, Layer Records, PackBits RLE, Channel Masks ID `-2`, Composite Image).
     - Non-rectangular shape mask rasterizer (circle, rounded rect, polygon, heart, scallop, custom SVG).
  2. Implement `src-tauri/src/export_engine/carousel_slicer.rs`:
     - Continuous stage renderer for carousel slides.
     - Multi-slide slicing into `slide_01.jpg`, `slide_02.jpg`, ..., `slide_N.jpg` and `full_panorama.jpg`.
     - Timestamped output folder creation `[ProjectName]_Carousel_[Timestamp]/`.
  3. Register Tauri commands:
     - `export_carousel_slices`.
     - Connect PSD format branch into `export_album_high_res`.
  4. Write unit tests for PSD binary validation and carousel slicing pixel bounds.

### Plan 05-02: Lossless TIFF & Print-Ready PDF/X Vector Marks Pipeline & Frontend Export Suite Integration
- **Scope**:
  1. Add `tiff` crate dependency with LZW compression and implement `encode_tiff_with_dpi` (8-bit and 16-bit RGB with resolution tags).
  2. Enhance `assemble_pdf_from_jpegs` into `assemble_pdfx_print_ready`:
     - MediaBox, BleedBox, TrimBox hierarchy.
     - Pure vector PDF stream corner crop marks, center fold ticks, and slug text.
     - PDF/X-3 output intent and GTS metadata.
  3. Frontend UI integration in `ExportAlbumDialog.tsx`:
     - 5-format selector grid: JPEG, PNG, TIFF, PDF, PSD.
     - Format-specific configuration panels (TIFF bit-depth, PDF/X marks, PSD layer info).
     - Carousel Mode Export integration for seamless Instagram publishing.
  4. Comprehensive verification across all 4 formats.
