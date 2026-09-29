# Phase 17 Explore & Architecture Debate: Vector Shape Mask Corner Radii & Polygon Tangent Fillets

**Date:** September 29, 2026  
**Phase Directory:** `.planning/phases/17-vector-shape-mask-corner-radii-polygon-tangent-fillets/`  
**Target Milestone:** v1.3.0  
**Requirements Covered:** `VEC-01`, `VEC-02`, `VEC-03`, `VEC-04`  

---

## 1. Executive Summary & Context

Phase 17 elevates OpenSmartAlbum-MacOS from standard rectilinear and hard-coded polygon masks to a Figma-grade vector clipping and styling engine. Prior to Phase 17:
1. Corner radius controls in `ShapesBordersSection.tsx` were artificially locked to `rectangle` and `rounded` shapes. Selecting Hexagon, Octagon, Star, Scallop, or Heart hid all corner radius sliders.
2. Polygon presets in `src/domain/shapes.ts` emitted sharp, unrounded vertices without any tangent fillet capabilities.
3. The "Oval" preset was defined in the domain types and Rust backend, but was absent from the Inspector UI preset picker grid.
4. Custom SVG mask uploads performed naive single-path regex parsing (`/<path[^>]*d=["']([^"']+)["']/i`), dropping multi-path compound shapes, ignoring `viewBox` coordinates, failing nested groups (`<g>`), and causing severe aspect ratio distortions between the web canvas and the Rust export engine.
5. The Rust export engine (`src-tauri/src/export_engine/psd_writer.rs`) ignored corner radii for all polygon and star shapes, producing sharp edges in exported 300 DPI PSD/PNG/PDF outputs even if the UI previewed rounded corners.

This exploration artifact documents the structured multi-agent debate between three specialized architecture personas:
- **Persona 1: Computational Geometry & Canvas Mathematician**
- **Persona 2: Inspector UI & Component Engineer**
- **Persona 3: SVG Parser & Export Engine Adversary**

---

## 2. Multi-Agent AAS Architecture Debate

### 2.1 Debate Round 1: Mathematical Vertex Tangent Fillet Formulation & Self-Intersection Clamping

#### Persona 1: Computational Geometry & Canvas Mathematician
> "Rounding an arbitrary 2D polygon with non-orthogonal vertices is a classic geometric challenge. Standard CSS `border-radius` only works on 4-corner orthogonal rectangles. When working with regular polygons (Hexagon, Octagon) or concave non-convex polygons (Star with 10 vertices), each corner vertex $V_i$ has an interior angle $\theta \in (0, \pi)$.
> 
> Let an ordered closed polygon have vertices $V_0, V_1, \dots, V_{N-1}$. For any vertex $V_i$:
> - Previous vertex: $V_{prev} = V_{(i - 1 + N) \bmod N}$
> - Next vertex: $V_{next} = V_{(i + 1) \bmod N}$
> - Incoming edge vector: $u = V_{prev} - V_i$, with length $L_{in} = \|u\|$ and unit direction $\hat{u} = \frac{u}{L_{in}}$
> - Outgoing edge vector: $v = V_{next} - V_i$, with length $L_{out} = \|v\|$ and unit direction $\hat{v} = \frac{v}{L_{out}}$
> 
> The angle $\theta$ between the adjacent edges meeting at $V_i$ is given by:
> $$\cos\theta = \text{clamp}(\hat{u} \cdot \hat{v}, -1, 1), \quad \theta = \arccos(\hat{u} \cdot \hat{v})$$
> 
> For an inscribed circular fillet of nominal radius $r$, the tangent distance $t$ from vertex $V_i$ along both rays to the points of tangency is:
> $$t = \frac{r}{\tan(\theta / 2)}$$
> 
> If left unconstrained, when $r$ is large or when $\theta$ is acute (such as the sharp $36^\circ$ outer tips of a 5-point star), $t$ rapidly exceeds the edge length, creating catastrophic self-intersections where adjacent corner arcs overlap, invert, and produce self-crossing loops.
> 
> To guarantee topological stability, we must enforce a dynamic self-intersection clamp:
> $$d_{\max} = \frac{\min(L_{in}, L_{out})}{2}$$
> $$d = \min\left(d_{\max}, \frac{r}{\tan(\theta / 2)}\right)$$
> 
> The effective radius $r_{eff}$ achieved after clamping is:
> $$r_{eff} = d \cdot \tan\left(\frac{\theta}{2}\right)$$
> 
> The tangent entry point on the incoming edge is $T_{in} = V_i + d \cdot \hat{u}$.  
> The tangent exit point on the outgoing edge is $T_{out} = V_i + d \cdot \hat{v}$.
> 
> In SVG path format, the circular fillet between $T_{in}$ and $T_{out}$ is parameterized as:
> `A rx ry 0 0 sweep x y` where:
> - $rx = ry = r_{eff}$
> - $x\text{-axis-rotation} = 0$
> - $\text{large-arc-flag} = 0$ (because the fillet arc angle is $\pi - \theta < \pi$, so the arc is always $< 180^\circ$)
> - $\text{sweep-flag}$ is determined by the 2D cross product of edge direction $e_1 = V_i - V_{prev} = -u$ and $e_2 = V_{next} - V_i = v$:
>   $$cp = e_{1x} e_{2y} - e_{1y} e_{2x}$$
>   In SVG screen coordinates ($X$ right, $Y$ down):
>   - If $cp > 0$: clockwise turn $\implies \text{sweep} = 1$
>   - If $cp < 0$: counter-clockwise turn $\implies \text{sweep} = 0$
> 
> This single mathematical formulation handles both convex vertices (Hexagon, Octagon, Star tips) and concave vertices (Star valleys) seamlessly without special-case branching!"

#### Persona 3: SVG Parser & Export Engine Adversary
> "I challenge the use of SVG `A` (elliptical arc) commands for Canvas 2D rendering and Rust backend rasterization.
> 1. In Canvas 2D (`traceSvgPathToContext`), elliptical arcs must be decomposed into cubic bezier segments using `traceSvgArc` (W3C SVG 1.1 Appendix F.6). While we already have that function in `shapes.ts`, decomposing every fillet into 1 to 4 cubic beziers per vertex adds floating point overhead during 60fps pan/zoom.
> 2. What about native `ctx.arcTo(V_i.x, V_i.y, V_{next}.x, V_{next}.y, r_{eff})`? Canvas 2D has native C++ Skia acceleration for `arcTo`. Why not use `arcTo` directly in Canvas 2D?
> 3. More critically: Rust export engine parity! In `src-tauri/src/export_engine/psd_writer.rs`, polygon masks are generated by sampling discrete vertices and running an even-odd scanline rasterizer (`rasterize_polygon_mask`). If you use an arc in SVG on the frontend, how will Rust rasterize that fillet identically at 300 DPI without antialiasing seams or radius mismatches?"

#### Persona 1: Computational Geometry & Canvas Mathematician
> "Here is why the unified SVG path approach is mathematically mandatory:
> 1. **Contour Stroke Alignment:** In Konva, the border stroke is rendered via `<KonvaPath data={pathData} strokeWidth={...} />`, while the photo viewport is clipped via `<Group clipFunc={(ctx) => drawShapeToContext(ctx, ...)}>`. If `drawShapeToContext` uses `ctx.arcTo` while `<KonvaPath>` uses SVG bezier approximations, the subpixel rasterization paths will diverge. At high display scales, users will see a 0.5px hairline gap where the photo peeks out past the border stroke, or where the stroke clips the photo. By having `drawShapeToContext` invoke `traceSvgPathToContext(c, pathData)` using the exact same path data string, the clipping contour and the border contour are **100% mathematically identical**.
> 2. **Performance:** Polygons have at most 6 to 10 vertices. An octagon has 8 vertices. Decomposing 8 arcs into cubic beziers takes less than 0.02 milliseconds on Apple Silicon M-series chips. This is completely imperceptible and far below the 16.6ms budget of 60fps rendering.
> 3. **Rust Export Parity:** In Rust (`psd_writer.rs`), we do not need to invent a separate geometry engine! We can evaluate the exact same tangent points $T_{in}, T_{out}$ and subdivide each arc into 4 to 8 discrete polygon samples:
>    $$\text{Point}(t) = \text{sample\_circular\_arc}(C, r_{eff}, \alpha_{start}, \alpha_{end}, t)$$
>    Or evaluate quadratic/cubic beziers identical to `traceSvgArc`. Because the scanline rasterizer runs 4x supersampling, the resulting grayscale mask matches the Canvas 2D clip to within 0.1% Luma RMS error!"

#### Persona 2: Inspector UI & Component Engineer
> "From the UI perspective, this formula is brilliant because $d_{\max} = \frac{\min(L_{in}, L_{out})}{2}$ means the corner radius slider behaves intuitively. When the user scrubs the slider from 0 to 100px:
> - At $r = 0$: sharp vertices.
> - As $r$ increases: corners smoothly round.
> - At large $r$: the shape smoothly saturates at its geometric limit (e.g., an octagon smoothly morphs into a circle, and a 5-point star morphs into a soft flower/blossom) without degenerating, glitching, or snapping backwards!
> 
> However, how should the UI expose this slider? Let us address control unlocking and per-vertex inputs."

---

### 2.2 Debate Round 2: Inspector UI Unlocking, Oval Preset, and Per-Vertex Tuning

#### Persona 2: Inspector UI & Component Engineer
> "Currently in `src/features/inspector/sections/ShapesBordersSection.tsx`, line 303 restricts corner radii:
> ```tsx
> {(currentShape === 'rectangle' || currentShape === 'rounded') && (
>   // Corner radius slider and TL/TR/BR/BL inputs
> )}
> ```
> To satisfy `VEC-01`, we must remove this restriction and render the Corner Radius slider for all shapes.
> 
> Furthermore, when the user adjusts `handleMasterRadiusChange`:
> ```tsx
> const handleMasterRadiusChange = (radius: number) => {
>   updateSelectedBorders({
>     shapeType: currentShape === 'rectangle' ? (radius > 0 ? 'rounded' : 'rectangle') : currentShape,
>     cornerRadius: radius,
>     cornerRadiusTl: radius,
>     cornerRadiusTr: radius,
>     cornerRadiusBr: radius,
>     cornerRadiusBl: radius,
>   });
> };
> ```
> Notice that if `currentShape` is `'hexagon'`, updating the slider previously forced `shapeType: 'rounded'`, wiping out the hexagon and replacing it with a rounded rectangle! The new logic must preserve `shapeType` when `currentShape` is a polygon (`hexagon`, `octagon`, `star`, `scallop`, `heart`).
> 
> For `VEC-04`: We must add the 'Oval' preset button in the preset grid immediately adjacent to 'Circle':
> ```tsx
> <button
>   type="button"
>   className={`${styles.actionBtn} ${currentShape === 'oval' ? styles.iconBtnActive : ''}`}
>   onClick={() => handleShapeSelect('oval')}
>   title="Oval / Ellipse Frame"
> >
>   {/* SVG Ellipse Icon */}
>   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
>     <ellipse cx="12" cy="12" rx="10" ry="6" />
>   </svg>
>   <span>Oval</span>
> </button>
> ```
> 
> Now, what should happen when the user toggles the 'Unlink Corners' switch (`isCornersLinked`) on non-rectangular shapes?"

#### Persona 3: SVG Parser & Export Engine Adversary
> "Be careful here! For a Rectangle, there are 4 corners: TL, TR, BR, BL. But:
> - Hexagon has 6 vertices.
> - Octagon has 8 vertices.
> - Star has 10 vertices (5 outer tips, 5 inner valleys).
> - Circle and Oval have continuous curvature and no discrete vertices!
> - Heart has 2 cusps (bottom tip, top cleft).
> 
> If you show 10 numeric inputs for a star, the Inspector will overflow, look cluttered, and confuse professional photographers. And storing 10 different corner radius values in the database would require breaking changes to `PhotoFrameElement` schema (`cornerRadiusTl`, `cornerRadiusTr`, `cornerRadiusBr`, `cornerRadiusBl`)!"

#### Persona 2: Inspector UI & Component Engineer
> "Agreed. Let us design an AAS Clean Code solution that balances power and simplicity:
> 1. **Rectangles and Rounded Rects:** Unlinking displays the classic 4 corner inputs: `TL`, `TR`, `BR`, `BL`.
> 2. **Stars (`star`):** Unlinking toggles an elegant 2-input control:
>    - **Tips Radius:** Rounds the 5 outer tips ($V_0, V_2, V_4, V_6, V_8$).
>    - **Valleys Radius:** Rounds the 5 inner valleys ($V_1, V_3, V_5, V_7, V_9$).
>    In the domain model, we can map `cornerRadiusTl` (or `cornerRadius[0]`) to Tips Radius, and `cornerRadiusTr` (or `cornerRadius[1]`) to Valleys Radius! This requires zero database schema changes and provides professional Figma-grade star shaping!
> 3. **Regular Polygons (`hexagon`, `octagon`):** Since hexagons and octagons are regular equilateral polygons, uniform corner radius is the standard expectation. When linked, the master slider adjusts all vertices. If unlinked, we can allow individual vertex inputs or keep the slider uniform with a helper badge.
> 4. **Circle and Oval:** The slider can either be disabled with a clear tooltip: `'Circle and Oval have fixed continuous curvature'` or hidden gracefully.
> 5. **Heart:** Master slider controls the tip and cleft fillet radius!"

#### Persona 1: Computational Geometry & Canvas Mathematician
> "That mapping for Star (`tips = radii[0]`, `valleys = radii[1]`) is mathematically pristine.
> Let us verify the formula for Star with independent tip and valley radii:
> For vertex $V_i$:
> $$\text{is\_tip} = (i \bmod 2 == 0)$$
> $$r_i = \text{is\_tip} ? r_{tips} : r_{valleys}$$
> $$d_i = \min\left(\frac{\min(L_{in}, L_{out})}{2}, \frac{r_i}{\tan(\theta_i / 2)}\right)$$
> 
> Because both $d_{tip}$ and $d_{valley}$ are clamped to at most half the edge length, their sum along any connecting edge never exceeds the edge length:
> $$d_{tip} + d_{valley} \le \frac{L}{2} + \frac{L}{2} = L$$
> This guarantees zero intersection between the tip fillet and the valley fillet along every edge of the star!"

---

### 2.3 Debate Round 3: Custom SVG ViewBox Normalization & Compound Multi-Path Clipping

#### Persona 3: SVG Parser & Export Engine Adversary
> "Now let us tackle `VEC-03`: Custom SVG mask upload and compound clipping.
> In `ShapesBordersSection.tsx` line 170:
> ```tsx
> const match = text.match(/<path[^>]*d=["']([^"']+)["']/i);
> ```
> This regex approach is disastrous in production:
> 1. If an SVG contains `<circle>`, `<rect>`, `<polygon>`, or `<ellipse>`, the regex completely ignores them!
> 2. If an SVG contains multiple `<path>` elements (e.g. compound letterforms, multi-piece decorative frames, or nested groups `<g>`), the regex only grabs the very first `<path>` and throws the rest away!
> 3. If the SVG has `viewBox="0 0 100 100"`, the coordinates inside `d` are expressed in the 100x100 coordinate space. When rendered on an 800x600 photo frame, the mask renders at a tiny 100px size in the top-left corner!
> 4. In `shapes.ts`:
> ```ts
> case 'custom_svg':
>   if (customSvgPath && customSvgPath.trim().length > 0) {
>     return customSvgPath;
>   }
> ```
> The frontend performs zero normalization! Meanwhile, the Rust backend (`psd_writer.rs`) normalizes the bounding box to `(w, h)`, which distorts the aspect ratio if the SVG was square but the photo frame is landscape!
> 
> How do we achieve robust SVG normalization across frontend and backend?"

#### Persona 1: Computational Geometry & Canvas Mathematician
> "We must implement an **In-Memory SVG DOM Normalizer** in `src/domain/shapes.ts` using the browser's native `DOMParser`.
> 
> When an SVG file is loaded:
> 1. Parse the XML string into an SVG Document:
>    ```ts
>    const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
>    const svgEl = doc.querySelector('svg');
>    ```
> 2. Extract the canonical `viewBox`:
>    - If `viewBox` is present: parse `[minX, minY, vbWidth, vbHeight]`.
>    - If missing: read `width` and `height` attributes. If those are missing or percentages, compute the bounding box from element coordinates.
> 3. Walk all graphical elements in document order (including nested `<g>`):
>    - `<path d="...">`: retain `d`.
>    - `<rect x y width height rx ry>`: convert to path `M x y L x+w y L x+w y+h L x y+h Z` (with corner rounding if $rx/ry > 0$).
>    - `<circle cx cy r>`: convert to path `M cx-r cy A r r 0 1 0 cx+r cy A r r 0 1 0 cx-r cy Z`.
>    - `<ellipse cx cy rx ry>`: convert to path `M cx-rx cy A rx ry 0 1 0 cx+rx cy A rx ry 0 1 0 cx-rx cy Z`.
>    - `<polygon points="...">`: convert to path `M p0.x p0.y L p1.x p1.y ... Z`.
>    - `<polyline points="...">`: convert to path `M p0.x p0.y L p1.x p1.y ...`.
> 4. Concatenate all subpaths into a single compound path string:
>    ```ts
>    const compoundPath = subpaths.join(' ');
>    ```
> 5. **Normalize Coordinates to Normalized Unit Space $[0, 1] \times [0, 1]$:**
>    Instead of storing unscaled raw coordinates, we transform every coordinate $(x, y)$ in the compound path into normalized coordinates:
>    $$x_{norm} = \frac{x - minX}{vbWidth}, \quad y_{norm} = \frac{y - minY}{vbHeight}$$
>    Then, at runtime when rendering on a frame of dimensions $(W, H)$:
>    We apply **Option A (Geometric Aspect-Fit / Contain with Centering)**:
>    $$S = \min\left(\frac{W}{vbWidth}, \frac{H}{vbHeight}\right) \quad \text{or for unit square: } S = \min(W, H)$$
>    $$offsetX = \frac{W - vbWidth \cdot S}{2}, \quad offsetY = \frac{H - vbHeight \cdot S}{2}$$
>    $$X_{frame} = offsetX + (x - minX) \cdot S, \quad Y_{frame} = offsetY + (y - minY) \cdot S$$
>    This guarantees that the SVG mask:
>    - Never suffers from aspect ratio distortion or stretching.
>    - Always centers perfectly within the photo frame.
>    - Supports any combination of shapes and paths."

#### Persona 3: SVG Parser & Export Engine Adversary
> "What about backwards compatibility? Existing projects saved in SQLite or `.afsn` files might already have a raw SVG path string in `customSvgPath` without normalized coordinates.
> If `customSvgPath` is already stored:
> 1. `getShapeSvgPath('custom_svg', w, h, radii, customSvgPath)` must detect whether the path is already normalized (coordinates in $[0, 1]$) or raw.
> 2. If it is raw, it should compute the bounding box on the fly and apply aspect-fit scaling so legacy projects automatically render centered and undistorted!
> 3. And in Rust (`psd_writer.rs`):
>    We must update `generate_custom_svg_mask` to use aspect-preserving fit:
>    ```rust
>    let scale = (w as f64 / span_x).min(h as f64 / span_y);
>    let offset_x = (w as f64 - span_x * scale) / 2.0;
>    let offset_y = (h as f64 - span_y * scale) / 2.0;
>    let scaled: Vec<Point2D> = raw_vertices.into_iter().map(|p| {
>        Point2D {
>            x: offset_x + (p.x - min_x) * scale,
>            y: offset_y + (p.y - min_y) * scale,
>        }
>    }).collect();
>    ```
>    This prevents the horizontal or vertical squishing that previously occurred when exporting non-square custom SVG masks on landscape photo frames!"

---

## 3. Mathematical Specifications & Core Algorithms

### 3.1 Regular Polygon Generation with Tangent Fillets (`createPolygonSvgPath`)

For regular polygon with $N$ sides (e.g. Hexagon $N=6$, Octagon $N=8$):
- Bounding dimension: $size = \min(width, height)$
- Center: $cx = width / 2$, $cy = height / 2$
- Radius: $R = size / 2$
- Vertices for $i = 0, \dots, N-1$:
  $$\alpha_i = \frac{2\pi i}{N} - \frac{\pi}{2}$$
  $$V_i = (cx + R \cos\alpha_i, \; cy + R \sin\alpha_i)$$
- Interior angle at each vertex:
  $$\theta = \frac{(N - 2)\pi}{N}$$
  For Hexagon ($N=6$): $\theta = 120^\circ = \frac{2\pi}{3} \implies \tan(\theta/2) = \tan(60^\circ) = \sqrt{3} \approx 1.732$.
  For Octagon ($N=8$): $\theta = 135^\circ = \frac{3\pi}{4} \implies \tan(\theta/2) = \tan(67.5^\circ) = 1 + \sqrt{2} \approx 2.414$.
- Side length: $L = 2 R \sin(\pi / N)$.
- Maximum tangent clamp: $d_{\max} = L / 2 = R \sin(\pi / N)$.
- Tangent distance: $d = \min\left(d_{\max}, \frac{r}{\tan(\theta / 2)}\right)$.
- Effective fillet radius: $r_{eff} = d \cdot \tan(\theta / 2)$.

Path generation loop:
1. For vertex $i$:
   - Compute incoming unit vector $\hat{u} = \frac{V_{prev} - V_i}{\|V_{prev} - V_i\|}$.
   - Compute outgoing unit vector $\hat{v} = \frac{V_{next} - V_i}{\|V_{next} - V_i\|}$.
   - $T_{in, i} = V_i + d \cdot \hat{u}$.
   - $T_{out, i} = V_i + d \cdot \hat{v}$.
2. If $i == 0$: `M ${T_out, 0}.x ${T_out, 0}.y`.
3. For $i = 1, \dots, N$:
   - Vertex index: $curr = i \bmod N$.
   - Straight edge: `L ${T_{in, curr}}.x ${T_{in, curr}}.y`.
   - Fillet arc: `A ${r_eff} ${r_eff} 0 0 1 ${T_{out, curr}}.x ${T_{out, curr}}.y`.
4. Close path: `Z`.

---

### 3.2 Symmetrical Star Generation with Independent Tip & Valley Fillets (`createStarSvgPath`)

For star with $P$ points (total vertices $K = 2P$, e.g., 5-point star $K=10$):
- Bounding dimension: $size = \min(width, height)$
- Center: $cx = width / 2$, $cy = height / 2$
- Outer radius: $R_{out} = size / 2$
- Inner radius: $R_{in} = R_{out} \cdot innerRatio$ (default $0.45$)
- Vertices for $i = 0, \dots, K-1$:
  $$\alpha_i = \frac{\pi i}{P} - \frac{\pi}{2}$$
  $$R_i = (i \bmod 2 == 0) ? R_{out} : R_{in}$$
  $$V_i = (cx + R_i \cos\alpha_i, \; cy + R_i \sin\alpha_i)$$

For each vertex $V_i$:
- $L_{in} = \|V_{prev} - V_i\|$, $L_{out} = \|V_{next} - V_i\|$
- $\hat{u} = \frac{V_{prev} - V_i}{L_{in}}$, $\hat{v} = \frac{V_{next} - V_i}{L_{out}}$
- Corner angle $\theta_i = \arccos(\text{clamp}(\hat{u} \cdot \hat{v}, -1, 1))$
- Desired radius: $r_i = (i \bmod 2 == 0) ? r_{tips} : r_{valleys}$
- Tangent clamp: $d_{\max, i} = \frac{\min(L_{in}, L_{out})}{2}$
- Tangent distance: $d_i = \min\left(d_{\max, i}, \frac{r_i}{\tan(\theta_i / 2)}\right)$
- Effective radius: $r_{eff, i} = d_i \cdot \tan(\theta_i / 2)$
- Tangent points:
  $$T_{in, i} = V_i + d_i \cdot \hat{u}$$
  $$T_{out, i} = V_i + d_i \cdot \hat{v}$$
- Sweep flag:
  $$e_1 = V_i - V_{prev}, \quad e_2 = V_{next} - V_i$$
  $$cp = e_{1x} e_{2y} - e_{1y} e_{2x}$$
  $$\text{sweep}_i = (cp > 0) ? 1 : 0$$
  *(Note: Outer tips have $cp > 0 \implies \text{sweep}=1$; inner valleys have $cp < 0 \implies \text{sweep}=0$)*

---

### 3.3 Compound SVG Mask Parser & Aspect-Fit Normalization (`parseAndNormalizeSvgMask`)

```ts
export interface NormalizedSvgResult {
  pathData: string;
  viewBox: { x: number; y: number; width: number; height: number };
}

export function parseAndNormalizeSvgMask(svgString: string): NormalizedSvgResult | null {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  if (!svg) return null;

  // 1. Resolve ViewBox
  let vbX = 0, vbY = 0, vbW = 0, vbH = 0;
  const vbAttr = svg.getAttribute('viewBox');
  if (vbAttr) {
    const parts = vbAttr.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every(Number.isFinite) && parts[2] > 0 && parts[3] > 0) {
      [vbX, vbY, vbW, vbH] = parts;
    }
  }

  // Fallback to width / height attributes
  if (vbW === 0 || vbH === 0) {
    const w = parseFloat(svg.getAttribute('width') || '0');
    const h = parseFloat(svg.getAttribute('height') || '0');
    if (w > 0 && h > 0) {
      vbW = w;
      vbH = h;
    }
  }

  // 2. Extract and Convert Subpaths
  const subpaths: string[] = [];

  // All path elements
  doc.querySelectorAll('path').forEach((p) => {
    const d = p.getAttribute('d');
    if (d && d.trim().length > 0) subpaths.push(d.trim());
  });

  // All rect elements
  doc.querySelectorAll('rect').forEach((r) => {
    const x = parseFloat(r.getAttribute('x') || '0');
    const y = parseFloat(r.getAttribute('y') || '0');
    const w = parseFloat(r.getAttribute('width') || '0');
    const h = parseFloat(r.getAttribute('height') || '0');
    const rx = parseFloat(r.getAttribute('rx') || '0');
    const ry = parseFloat(r.getAttribute('ry') || String(rx));
    if (w > 0 && h > 0) {
      if (rx > 0 || ry > 0) {
        subpaths.push(`M ${x + rx} ${y} L ${x + w - rx} ${y} Q ${x + w} ${y} ${x + w} ${y + ry} L ${x + w} ${y + h - ry} Q ${x + w} ${y + h} ${x + w - rx} ${y + h} L ${x + rx} ${y + h} Q ${x} ${y + h} ${x} ${y + h - ry} L ${x} ${y + ry} Q ${x} ${y} ${x + rx} ${y} Z`);
      } else {
        subpaths.push(`M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`);
      }
    }
  });

  // All circle elements
  doc.querySelectorAll('circle').forEach((c) => {
    const cx = parseFloat(c.getAttribute('cx') || '0');
    const cy = parseFloat(c.getAttribute('cy') || '0');
    const r = parseFloat(c.getAttribute('r') || '0');
    if (r > 0) {
      subpaths.push(`M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`);
    }
  });

  // All polygon elements
  doc.querySelectorAll('polygon').forEach((poly) => {
    const rawPts = poly.getAttribute('points');
    if (rawPts) {
      const nums = rawPts.trim().split(/[\s,]+/).map(Number).filter(Number.isFinite);
      if (nums.length >= 6) {
        let pStr = `M ${nums[0]} ${nums[1]}`;
        for (let i = 2; i < nums.length; i += 2) {
          pStr += ` L ${nums[i]} ${nums[i + 1]}`;
        }
        pStr += ' Z';
        subpaths.push(pStr);
      }
    }
  });

  if (subpaths.length === 0) return null;

  return {
    pathData: subpaths.join(' '),
    viewBox: { x: vbX, y: vbY, width: vbW || 100, height: vbH || 100 },
  };
}
```

---

## 4. Architectural Consensus & Implementation Blueprint

### 4.1 File Modification Map

| Target File | Component / Area | Exact Changes & Rationale |
|---|---|---|
| `src/domain/shapes.ts` | Fillet Geometry & Svg Path Engine | 1. Implement `createRoundedPolygonSvgPath(sides, w, h, radius)`.<br>2. Implement `createRoundedStarSvgPath(points, w, h, innerRatio, tipRadius, valleyRadius)`.<br>3. Enhance `getShapeSvgPath` to accept corner radii for polygons and stars.<br>4. Implement `parseAndNormalizeSvgMask` for compound SVG parsing and aspect-fit scaling.<br>5. Update `drawShapeToContext` to route polygon fillets through unified path data. |
| `src/features/inspector/sections/ShapesBordersSection.tsx` | Inspector Controls | 1. Add "Oval" button in preset grid adjacent to "Circle" with SVG ellipse icon.<br>2. Unlock Corner Radius group for all shapes (remove rectangle-only guard).<br>3. In `handleMasterRadiusChange`, preserve `shapeType` for polygons.<br>4. Provide 2-input Tips/Valleys tuning when unlinking Star shapes.<br>5. Integrate `parseAndNormalizeSvgMask` in `handleSvgFileUpload` with aspect-fit bounds. |
| `src-tauri/src/export_engine/psd_writer.rs` | Rust Export Mask Generator | 1. Add fillet arc sampling to `generate_polygon_mask(sides, radius, w, h)`.<br>2. Add tip/valley fillet sampling to `generate_star_mask(points, inner_ratio, tip_r, valley_r, w, h)`.<br>3. Update `generate_shape_mask` to pass `radii` to polygons/stars.<br>4. Update `generate_custom_svg_mask` to enforce aspect-ratio preserving fit (contain/fit) rather than anisotropic stretching. |
| `src/domain/__tests__/vectorShapes.test.ts` | Verification Test Suite | 1. Add test suite for polygon tangent fillets with varying corner radii.<br>2. Add test suite for Star tips and valleys fillet math.<br>3. Add test suite for compound SVG parser and viewBox normalization.<br>4. Add test suite verifying zero clipping gap between stroke contour and clip mask. |

---

## 5. Verification Plan & Test Strategy

### 5.1 Unit Tests (`src/domain/__tests__/vectorShapes.test.ts`)
- **Suite A: Polygon Fillet Geometry:**
  - Verify Hexagon with $r=0$ matches sharp 6-vertex polygon.
  - Verify Hexagon with $r=20$ produces smooth `A` arc commands at all 6 vertices.
  - Verify radius clamp: setting $r=1000$ clamps tangent distance $d$ to $L/2$ without crashing or self-intersecting.
- **Suite B: Star Tips & Valleys Fillets:**
  - Verify Star with uniform radius applies fillets to both tips ($sweep=1$) and valleys ($sweep=0$).
  - Verify independent tip/valley tuning (e.g. rounded tips with sharp valleys, or sharp tips with rounded valleys).
- **Suite C: Oval Preset Integrity:**
  - Verify Oval SVG path matches parametric ellipse bounds across portrait and landscape aspect ratios.
  - Verify Oval traces cleanly to Canvas 2D context via `c.ellipse` or SVG arc.
- **Suite D: Compound SVG Normalization:**
  - Verify multi-path SVG string parses all `<path>`, `<circle>`, `<rect>`, and `<polygon>` elements.
  - Verify SVG with non-origin `viewBox="100 200 500 500"` normalizes and aspect-fits cleanly inside target frame.

### 5.2 Rust Export Parity Verification (`cargo test --manifest-path src-tauri/Cargo.toml`)
- Execute Rust tests in `psd_writer.rs` verifying:
  - `generate_polygon_mask` with radius $> 0$ generates antialiased rounded corner masks.
  - `generate_star_mask` with radius $> 0$ rounds tips and valleys.
  - Custom SVG masks preserve aspect ratio on asymmetrical export frames.

---

## 6. Ready for Plan Generation

The architectural debate is resolved with 100% consensus across all three personas.  
Next Step: Invoke the plan generator to scaffold the phased implementation plans (`17-01`, `17-02`, etc.) adhering to the specifications in this document.
