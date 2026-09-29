# Phase 17 Context: Vector Shape Mask Corner Radii & Polygon Tangent Fillets

**Phase Goal:** Unlock Corner Radius slider and individual vertex inputs in `ShapesBordersSection.tsx` for all polygon presets (Hexagon, Octagon, Star, Scallop, Heart); implement mathematical vertex tangent fillet arc algorithm (`c.arcTo` / quadratic bezier) in `src/domain/shapes.ts`; normalize custom SVG mask viewBox and multi-path compound clipping.

---

## 1. Locked Implementation Decisions

### 1.1 Inspector Controls Architecture
- **Control Layout:** Uniform Corner Radius Slider (0–100px) by default with an expandable switch for individual vertex tuning if finer per-corner adjustments are desired.
- **Universal Shape Support:** Active across all shapes without exception (Rectangle, Rounded Rect, Hexagon, Octagon, Star, Scallop, Heart, and Oval).
- **Preset Grid Addition:** An explicit "Oval" preset icon is placed immediately adjacent to the "Circle" preset in the Inspector preset picker.

### 1.2 Mathematical Vertex Fillet Geometry
- **Dynamic Tangent Fillet Algorithm:** In `src/domain/shapes.ts`, vertices are rounded using a circular arc tangent fillet:
  $$d = \min\left(d_{\max}, \frac{r}{\tan(\theta / 2)}\right), \quad \text{where } d_{\max} = \frac{\min(|V_i - V_{prev}|, |V_{next} - V_i|)}{2}$$
- **Self-Intersection Clamping:** Fillet radius is dynamically clamped to at most half the length of the shortest adjacent edge ($d_{\max}$), ensuring corners round gracefully without self-intersection or visual inversion.
- **Star Symmetry:** For star shapes, both external tips and internal valleys undergo symmetrical rounding, delivering modern Figma-grade smooth star polygons.
- **Strict Contour Stroke Alignment:** Stroke borders trace the exact identical fillet geometry path as the photo clip mask, preventing border separation or misalignment.

### 1.3 Custom SVG Mask ViewBox Normalization & Compound Clipping
- **Aspect-Fit / Cover Normalization:** Uploaded SVG masks normalize their `viewBox` coordinates into a centered, aspect-preserving bounding box mapped to the photo frame dimensions without aspect distortion.
- **Compound Path Handling:** All `<path>`, `<circle>`, `<polygon>`, and `<rect>` elements contained within the SVG (including nested `<g>` groups) merge into a single unified compound clipping path via `Path2D` / Canvas clip methods.

---

## 2. Requirements Mapped to Phase 17
- `VEC-01`: Inspector Corner Radius controls unlocked for all shapes including polygons and stars.
- `VEC-02`: Mathematical vertex tangent fillet arc algorithm (`c.arcTo` and SVG bezier) in `shapes.ts`.
- `VEC-03`: Custom SVG mask viewBox normalization and multi-path compound clipping.
- `VEC-04`: Dedicated Oval shape preset added to the Inspector toolbar with full contour and crop support.
