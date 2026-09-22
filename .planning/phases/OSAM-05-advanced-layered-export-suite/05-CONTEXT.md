# Phase 5: Advanced Layered Export Suite — Context

## Implementation Decisions

### 1. Adobe Photoshop (.psd) Layered Serializer
- **Layer & Mask Structure**:
  - `Background`: Solid canvas color or background texture layer.
  - `Photo Layers`: Each frame is an individual raster layer (e.g. `Photo_01`, `Photo_02`) with its native unclipped bitmap data preserved.
  - `Alpha Layer Masks`: Non-rectangular shapes (Circle, Hexagon, Scallop, Heart, custom SVG) export as true Photoshop channel layer masks attached to the layer, keeping the underlying photo intact for post-processing in Adobe Photoshop.
  - `Text Layers`: Text elements rendered as crisp raster layers with DPI matching project settings.
- **Resolution & Color**:
  - Embeds 300 DPI (or configured project DPI) in PSD Image Resources block `0x03ED`.
  - Encoded in 8-bit RGB / sRGB or AdobeRGB color mode with PackBits/RLE compression.

### 2. Instagram Multi-Slide Slice Exporter
- **Output Directory Structure**:
  - Exports into a dedicated folder: `[ProjectName]_Carousel_[Timestamp]/`
  - Numbered slice images: `slide_01.jpg`, `slide_02.jpg`, ... `slide_N.jpg` cropped precisely to slide boundaries ($1080 \times 1080$ or $1080 \times 1350$).
  - Full panoramic preview image: `full_panorama.jpg` (all slides stitched together) for easy portfolio sharing and review.
- **Compression & Quality**: High-quality JPEG (92% quality) with sRGB color profile.

### 3. Print-Ready TIFF & PDF/X Export
- **TIFF Output**: LZW lossless compressed 8-bit or 16-bit RGB TIFF at 300 DPI, supporting professional photo printing labs without generation loss.
- **PDF/X Output**: Vector text preservation with `fontdue` embedded fonts, configurable bleed margin lines ($3\text{mm}$ standard), slug, and trim/crop mark guides.

---
*Created: 2026-09-22 via /gsd-discuss-phase*
