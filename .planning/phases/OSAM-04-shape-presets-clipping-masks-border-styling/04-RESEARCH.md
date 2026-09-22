# Phase 4 Technical Research: Shape Presets, Clipping Masks & Border Styling

**Phase**: OSAM-04-shape-presets-clipping-masks-border-styling  
**Date**: 2026-09-22  
**Status**: Completed  
**Author**: Lead Systems Engineer & Codebase Architect  

---

## 1. Scope & Objective

Phase 4 transforms photo frames in OpenSmartAlbum from simple rectangular windows into expressive Canva- and Photoshop-style geometric shapes, clipping masks, and decorative borders:
- **Vector Presets**: Rectangle, Rounded Rectangle, Circle/Oval, Hexagon, Octagon, Star, Scallop/Cloud, and Heart.
- **Custom Vector SVG Masks**: Allow dropping custom SVG path strings as clipping silhouettes.
- **Border & Stroke System**: Center, inner, or outer stroke alignment; solid, dashed, and double line styles.
- **Drop Shadows**: Contour-following drop shadows with customizable offset, blur, color, and opacity.
- **2D Topological Multi-Resize Compatibility**: Guarantee non-rectangular frames maintain exact gap spacing through `calculateMultiFrameResize`.

---

## 2. Technical Architecture & Implementation Details

### 2.1 Geometry & Clipping Function Generator (`src/domain/shapes.ts`)
Konva supports custom clipping on `Group` nodes via `clipFunc: (ctx: Konva.Context) => void`.
Canvas 2D Path algorithms:
- **Rectangle**: `ctx.rect(0, 0, width, height)` or `ctx.roundRect(...)`
- **Circle / Oval**: `ctx.ellipse(width / 2, height / 2, width / 2, height / 2, 0, 0, Math.PI * 2)`
- **Polygon (Hexagon / Octagon)**: Regular polygon calculated around center $(w/2, h/2)$ using polar coordinates $(r \cos \theta, r \sin \theta)$.
- **Star**: Alternating outer radius ($r_1$) and inner radius ($r_2 = 0.4 \times r_1$) with 5 or 8 points.
- **Heart**: Cubic bezier curve path starting at $(w/2, 0.8h)$ with two upper lobes.
- **Scallop / Cloud**: Circular arcs arrayed around the bounding perimeter.
- **Custom SVG**: Canvas `Path2D(svgPathData)` scaled to $(w, h)$ bounds.

### 2.2 Data Model Extension (`src/domain/editor.ts`)
Extend `PhotoFrameElement` with non-breaking optional fields:
```typescript
export type ShapeType =
  | 'rectangle'
  | 'rounded'
  | 'circle'
  | 'oval'
  | 'hexagon'
  | 'octagon'
  | 'star'
  | 'scallop'
  | 'heart'
  | 'custom_svg';

export interface PhotoFrameElement {
  // ... existing fields ...
  shapeType?: ShapeType;
  customSvgPath?: string;
  borderStyle?: 'solid' | 'dashed' | 'double';
  borderAlignment?: 'inner' | 'center' | 'outer';
  shadowEnabled?: boolean;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowOpacity?: number;
}
```

### 2.3 Topological Resize Preservation
`calculateMultiFrameResize` in `src/domain/editor.ts` uses the outer bounding box (`x, y, width, height`) of each frame. Because non-rectangular frames are clipped internally within their $(w, h)$ bounding boxes, the 2D Topological Spatial Neighbor Graph algorithm naturally preserves all physical gap distances between adjacent frames across rows, columns, and asymmetrical collages.

---

## 3. Plan Breakdown

- **Plan 04-01**: Vector Shape Clipping Engine (`src/domain/shapes.ts`), Data Model Extensions, and Konva Canvas Clipping Integration.
- **Plan 04-02**: Advanced Borders (Solid, Dashed, Double), Drop Shadows, and Modular Inspector UI Controls (`ShapesBordersSection.tsx`).

---
*Status: Ready for Implementation.*
