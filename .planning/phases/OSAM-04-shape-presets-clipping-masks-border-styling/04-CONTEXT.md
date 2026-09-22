# Phase 4: Shape Presets, Clipping Masks & Border Styling — Context

## Implementation Decisions

### 1. Shape Engine & Clipping Architecture
- **Konva Clipping Mechanism**: Use `Konva.Group` with dynamic `clipFunc` leveraging standard Canvas `Path2D` objects.
  - Keeps inner `<Image />` pan, zoom, and crop independent from outer shape bounds.
  - Supports `↺ Reset Ratio` (restores frame aspect ratio without resetting pan/zoom) and `↺ Reset Crop` (re-centers photo and sets zoom to 1.0x).
- **Preset Library**:
  - `Rectangle` & `Rounded Rectangle` (with independent per-corner radius controls)
  - `Circle` & `Oval`
  - `Hexagon` & `Octagon` (sharp or rounded polygon corners)
  - `Star` (5-point & 8-point with inner radius ratio)
  - `Scallop / Cloud` (wavy fluted decorative border for wedding albums)
  - `Heart`
- **Custom Vector Mask**:
  - Direct drag-and-drop of `.svg` files onto any selected frame.
  - Normalizes SVG `d` path strings into relative $[0, 1]$ bounding coordinates so masks scale smoothly with frame geometry.

### 2. Multi-Frame Topological Resize Compatibility
- **2D Topological Spatial Neighbor Graph**:
  - The resize engine (`calculateMultiFrameResize`) operates on the outer bounding box ($x, y, width, height$) of each shape.
  - Strict preservation of project photo spacing gaps (configured in SQLite and properties panel) across asymmetrical collages, regardless of whether individual frames are rectangular, hexagonal, or scalloped.

### 3. Advanced Border, Stroke & Shadow System
- **Stroke Controls**:
  - Width: $0$ to $50\text{px}$.
  - Alignment: Outer, Center, or Inner border.
  - Style: Solid, Dashed (custom dash/gap array), or Double line.
  - Color: Native macOS color picker with opacity and hex/RGB support.
- **Drop Shadows**:
  - Configurable X and Y offsets, blur radius, color, and opacity.
  - Shadow casts accurately following the contour of the clipped vector shape (not just a square box).

---
*Created: 2026-09-22 via /gsd-discuss-phase*
