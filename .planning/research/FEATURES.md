# Feature Research

**Domain:** Professional Wedding & Portrait Album Design & Social Carousel Layout Engine (macOS Desktop Tauri 2 + React 18 + Konva.js)  
**Researched:** 2026-09-23  
**Confidence:** HIGH  

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features professional album designers and studio photographers take for granted. If any of these are missing or buggy, the software feels broken or amateurish compared to industry standards (Pixellu SmartAlbums, Fundy Designer, AlbumStomp).

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Non-Destructive $N$-Photo Layout Cycling (`Spacebar` / `Shift+Space`)** | Photographers need to rapidly audition visual arrangements without re-importing, re-dragging, or losing images. Every press cycles to a new mathematically balanced variation for the exact $N$ photos on the spread. | HIGH | Uses recursive binary space partitioning (R-BSP) with bipartite minimum-crop-cost matching (`findOptimalPhotoSlotMapping`). Must support forward (`Space`) and backward (`Shift+Space`) cycling. State persists across undo/redo. |
| **Zero Blank Frames / No Ghost Placeholders** | Desktop studio tools must NEVER display empty grey placeholder boxes or require dummy image drops. When $N$ photos are placed, exactly $N$ frames are rendered. | MEDIUM | Every layout variation is generated dynamically based on the exact active photo count ($N \in [1..15]$). Adding or removing a photo re-partitions the usable area immediately with zero leftover empty slots. |
| **Aspect-Fill Cover Fit with Normalized Focal-Point Preservation** | Photos have disparate aspect ratios (3:2, 4:3, 1:1, 16:9). Frames must automatically fill their allocated rectangle (`object-fit: cover`) without letterboxing, while centering key subjects. | MEDIUM | Preserves normalized focal centers `(focalX, focalY)` during layout cycling so manual face centering or framing adjustments are not lost when switching between landscape, square, or vertical slots. |
| **Instant Spread In-Frame Crop / Pan Tool** | Designers must be able to fine-tune image framing directly within the layout (double-click frame to pan/zoom) without switching to an external editor or modal window. | MEDIUM | Konva-based direct manipulation with bounding-box clipping, mouse wheel zoom, and drag panning with bounds clamping (preventing whitespace bleed inside the frame). |
| **Keyboard & Navigation Disambiguation** | Spacebar is universally used in graphic software (Photoshop, Illustrator, Figma) for Hand Pan (`Space + Drag`), while album tools use Spacebar to cycle layouts. Ambiguity causes accidental layout changes or broken panning. | MEDIUM | Event disambiguation: `keydown Space` with drag activates canvas pan; pure `tap Space` (keydown then keyup without mouse movement or canvas click) or explicit shortcut triggers layout cycling. Bypassed when typing in text fields or in crop edit mode. |
| **Spine Gutter & Safe Margin Boundary Enforcement** | Print labs enforce strict safe zones (margins, spine trim, and bleed). Photos must snap to safe areas or explicitly extend to full bleed, avoiding vital details falling into the binding gutter. | HIGH | Dynamic layout engine computes usable page areas (`getUsableAreas`) taking into account `safeMarginTop`, `safeMarginBottom`, `safeMarginOutside`, and `safeMarginSpine`, while preventing single-page photos from crossing the center spine. |

---

### Differentiators (Competitive Advantage)

Features that elevate OpenSmartAlbum above legacy commercial tools, transforming a manual page builder into an intelligent, high-velocity storytelling workstation.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Auto-Flow Multi-Spread / Slide Storytelling Engine** | Batch-ingesting 10–50+ photos instantly generates a complete, rhythmically paced album or Instagram carousel. Rather than dumping photos into uniform grids, it creates natural visual cadence (hero spreads alternating with detail grids). | HIGH | Evaluates EXIF capture timestamps (temporal clustering into chapters), photo aspect ratios, and star ratings. Groups photos into coherent spreads (1–6 photos/spread) with alternating visual density and orientation harmony (e.g. matching 2P portraits, pairing 1L hero with 2P accents). |
| **Contextual Right-Click: Set as Full Bleed Spread** | 1-click transformation of any hero shot to span the entire double spread (left page, right page, and spine gutter) edge-to-edge, automatically handling remaining photos. | MEDIUM | Reconfigures frame coordinates to flush canvas width/height (`spreadWidth × spreadHeight`), adjusts z-index, and repositions displaced photos onto an adjacent new spread or balanced companion page. |
| **Contextual Right-Click: Set as Seamless Panorama Span** | Spans a landscape image across the book's center seam while applying split-page inside bleed compensation so subjects in the center are not distorted by the binding fold. | HIGH | In Social Carousel mode, spans seamless panorama photos across 2–5 Instagram slides (1080×1350 per slide). In Print Album mode, applies split-bleed margin expansion tailored to layflat vs. flush-mount lab specs. |
| **Contextual Right-Click: Set as Hero / Anchor Photo** | Elevates a selected photograph to become the focal anchor of the spread (dominant quadrant, 60–75% visual weight), while automatically arranging companion photos into secondary slots. | MEDIUM | Tags photo with anchor weight; the layout engine prioritizes this photo for the primary slot in bipartite assignment (`findOptimalPhotoSlotMapping` with hero rating boost), recalculating supporting frame partitions. |
| **Interactive In-Canvas Divider Dragging (Fundy Drop Zones Style)** | Direct manipulation of the boundary between adjacent photo frames. Dragging a divider line rebalances proportions (e.g. 50/50 split becomes 65/35) in real time while maintaining uniform gutters and outer bounds. | HIGH | Implements Konva hit-testing on inter-frame gutters (`col-resize` and `row-resize` cursor). Topological adjacency graph identifies shared edges and resizes twin or triplet frames symmetrically with real-time RAF rendering. |
| **Direct Drag-and-Drop Photo Swapping** | Dragging one photo directly onto another frame on the canvas instantly swaps their positions and adapts their crops without resetting the underlying layout geometry. | MEDIUM | Drag shadow/ghost overlay with drop target highlight ring. On drop, frame photo assets, aspect calculations, and focal points are cleanly exchanged, pushing an undo state to `historyStore`. |
| **Unified Print & Social Carousel Hybrid Story Engine** | Allows photographers to design a wedding spread and immediately repurpose it into a swipeable 10-slide Instagram carousel with continuous panoramic cuts and phone simulator preview. | MEDIUM | Leverages OpenSmartAlbum's dual-mode architecture. Preserves layout semantics across `albumStore` and `carouselStore`. |

---

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem appealing on paper or exist in legacy software, but create cognitive friction, workflow slowdowns, or destructive data loss.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Rigid Static Templates That Drop / Delete Photos** | Users coming from basic photobook software ask for fixed templates (e.g., "Template 4A: 3 photos"). | If a spread currently has 4 photos and the user applies a 3-photo template, photo #4 is silently deleted or banished to an "unassigned" tray, causing anxiety and lost work. | **Strictly Dynamic $N$-Photo Generative Partitioning**: All layout variations are generated for the *exact* number of photos on the spread. Zero photos are ever discarded. |
| **Modal-Heavy Layout Pickers** | Full-screen popups displaying hundreds of static layout thumbnails. | Opening a modal dialog disconnects the designer from canvas context, incurs rendering latency, blocks direct editing, and disrupts rapid creative flow. | **Lightweight Floating HUD + In-Situ Cycling**: Floating HUD (`LayoutCycleHUD`), keyboard hotkeys (`Space` / `Shift+Space`), and dockable sidebar drawer preview (`TemplatesPanel`) updating the active spread in real time. |
| **Unconstrained Freeform Overlapping Floating Frames by Default** | Users asking to freely drag frames anywhere like PowerPoint or basic desktop publishing. | Unconstrained freehand placement produces misaligned margins, uneven gutters, accidental spine violations, and unprintable layouts that fail lab preflight checks. | **Structured Grid Partitioning with Explicit "Custom Designer Mode"**: By default, frames obey strict magnetic studio grids, safe margins, and uniform gutters. Freeform floating manipulation is an opt-in mode with magnetic snap guides. |
| **Automatic Destructive Re-Cropping on Layout Cycle** | Automatically auto-centering every image from scratch upon every layout switch. | Destroys meticulous manual crop adjustments (e.g. designer specifically panned up to avoid cutting the bride's veil). | **Normalized Focal Anchor Points**: Store crop focal points as relative coordinates `(focalX: 0.5, focalY: 0.5)`. When layout dimensions change, framing preserves the designer's focal intent. |
| **Over-Automated "Black-Box" AI Layouts Without Regeneration Controls** | Users request "One-button AI design entire album". | Black-box AI generation often produces bizarre groupings, separates chronological sequences, crops family faces, and gives the designer zero insight or control over why choices were made. | **Transparent Rule-Based Storytelling Engine with Granular Pacing Controls**: Auto-flow uses clear grouping rules (timestamp clustering, star ratings, orientation harmony) with one-click chapter overrides and rapid spread cycling. |

---

## Feature Dependencies

```
[Aspect-Aware Dynamic Geometric Engine (R-BSP)]
       │
       ├──requires──> [Usable Area & Spine Boundary Solver]
       │
       └──requires──> [Bipartite Optimal Photo-Slot Assignment]
                              │
                              └──requires──> [Normalized Focal-Point Crop Model]

[Auto-Flow Storytelling Engine]
       │
       ├──requires──> [EXIF Timestamp & Orientation Clustering]
       │
       └──requires──> [Aspect-Aware Dynamic Geometric Engine (R-BSP)]
                              │
                              └──enhances──> [Multi-Spread Batch Ingestion]

[Contextual Right-Click Studio Actions]
       │
       ├──requires──> [Konva Spread Canvas Context Menu]
       │
       ├──enhances──> [Set as Full Bleed Spread] ──requires──> [Canvas Margin Bypass]
       │
       ├──enhances──> [Set as Panorama Span]    ──requires──> [Spine Split-Bleed Guard]
       │
       └──enhances──> [Set as Hero / Anchor]    ──requires──> [Hero-Weighted Slot Scoring]

[Interactive In-Canvas Divider Dragging]
       │
       ├──requires──> [Frame Adjacency & Boundary Graph]
       │
       ├──requires──> [Konva Inter-Frame Gutter Hit-Testing]
       │
       └──conflicts──> [Rigid Static Templates (Anti-Feature)]

[Keyboard Navigation: Space / Shift+Space]
       │
       ├──enhances──> [Aspect-Aware Dynamic Geometric Engine]
       │
       └──requires──> [Spacebar Tap vs. Pan-Drag Disambiguation]
```

### Dependency Notes

- **[Aspect-Aware Dynamic Engine] requires [Usable Area & Spine Boundary Solver]:** Layout rects cannot be computed without knowing physical page dimensions, print bleed, safe margins, and whether the spread is a single-page cover or double-page spread with a center gutter.
- **[Auto-Flow Storytelling Engine] requires [Aspect-Aware Dynamic Engine]:** Auto-flow clusters 10–50 photos into subsets of 1–6 photos per spread; each spread depends on the dynamic engine to render mathematically balanced, zero-blank layouts.
- **[Set as Panorama Span] requires [Spine Split-Bleed Guard]:** Spanning across the spine requires specialized width calculations to ensure the seam does not swallow key image portions during print binding.
- **[Interactive Divider Dragging] requires [Frame Adjacency & Boundary Graph]:** You cannot drag a divider without knowing which sibling frames share that coordinate boundary and how moving the line affects neighbor widths/heights while keeping total spread bounds invariant.
- **[Interactive Divider Dragging] conflicts with [Rigid Static Templates]:** Static templates expect hardcoded fixed coordinates; dynamic divider manipulation requires dynamic parametric rect containers.
- **[Spacebar Tap vs. Pan-Drag Disambiguation]:** Hand tool canvas panning (`Space + Drag`) and layout cycling (`Space tap`) share the same primary key; the input subsystem must differentiate between mouse-down pan drags and single-tap releases.

---

## MVP Definition

### Launch With (v1.2.0 Milestone)

Essential capabilities to deliver an industry-grade layout and storytelling experience matching Pixellu SmartAlbums and Fundy Designer.

- [x] **Aspect-Aware Dynamic Geometric Layout Engine ($N \in [1..15]$)** — Algorithmic R-BSP layout generator delivering zero blank frames, zero lost photos, and minimal crop penalties. *(Phase 10)*
- [x] **Non-Destructive Spacebar / Shift+Space Layout Cycling & HUD** — Keyboard-driven instantaneous layout exploration with circular variation index and visual match scoring. *(Phase 10)*
- [x] **Auto-Flow Multi-Spread Storytelling Engine** — Multi-photo batch ingestion (10–30+ photos) clustering by EXIF timestamp, orientation pairing, and visual density pacing. *(Phase 11)*
- [x] **Contextual Right-Click Studio Actions** — Fast actions for "Set as Full Bleed Spread", "Set as Seamless Panorama Span", and "Set as Hero / Anchor Photo". *(Phase 12)*
- [x] **Spine Bleed & Gutter Safety Guard** — Real-time warning and automated split-bleed compensation for photos crossing the binding seam. *(Phase 12)*
- [x] **Interactive In-Canvas Divider Dragging** — Hover hit-test on frame gutters with `col-resize` / `row-resize` handles to dynamically rebalance adjacent frame splits. *(Phase 13)*
- [x] **Direct Two-Photo Drag-and-Drop Swap** — Direct canvas swap of photo assignments between frames with animated drop highlight. *(Phase 13)*

### Add After Validation (v1.2.x)

Features to incorporate once the core dynamic layout and auto-flow engine are validated in production use.

- [ ] **Smart Face-Detection Auto-Focal Point** — Integrated local Apple Vision / CoreML face detection to automatically anchor `(focalX, focalY)` to human faces during aspect-fill cover fit.
- [ ] **Custom Spread Design Set Saving** — Enable users to save a custom-dragged spread layout to their user library as a reusable parametric archetype.
- [ ] **Multi-Image Drag Reorder on Filmstrip Timeline** — Visual drag-and-drop reordering of spreads and photos directly within the bottom timeline tray with real-time page renumbering.

### Future Consideration (v2+)

Long-term roadmap items for studio scale and advanced multi-channel workflows.

- [ ] **AI-Assisted Album Pacing & Culling Assistant** — On-device aesthetic quality scoring to suggest optimal hero photos and cull near-duplicates before auto-flowing.
- [ ] **Cloud Proofing & Client Comment Sync** — Native integration with web proofing portal for client approval and revision tagging directly on Konva canvas coordinates.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| **Aspect-Aware Dynamic Geometric Engine (Zero Blank, $N \in [1..15]$)** | HIGH | HIGH | P1 |
| **Non-Destructive Spacebar / Shift+Space Cycling** | HIGH | LOW | P1 |
| **Auto-Flow Multi-Spread Story Engine (Timestamp & Orientation Clustering)** | HIGH | HIGH | P1 |
| **Contextual Actions (Full Bleed, Panorama Span, Hero Anchor)** | HIGH | MEDIUM | P1 |
| **Interactive In-Canvas Divider Dragging** | HIGH | HIGH | P1 |
| **Direct Drag-and-Drop Photo Swapping** | MEDIUM | MEDIUM | P1 |
| **Spine & Binding Gutter Safety Detection** | HIGH | MEDIUM | P1 |
| **Face-Detection Auto-Focal Point (Apple Vision)** | MEDIUM | MEDIUM | P2 |
| **Custom Spread Preset Library Saving** | MEDIUM | LOW | P2 |
| **Filmstrip Timeline Visual Cut Insertion** | MEDIUM | MEDIUM | P2 |
| **AI Culling & Story Copywriting Assistant** | LOW | HIGH | P3 |

**Priority key:**
- **P1:** Must have for v1.2.0 milestone launch.
- **P2:** Fast follow-up in v1.2.x maintenance sprint.
- **P3:** Defer to v2.0+ architecture.

---

## Competitor Feature Analysis

| Dimension | Pixellu SmartAlbums | Fundy Designer (v10/v11) | AlbumStomp / Marqueteer | OpenSmartAlbum-MacOS (Our Approach) |
|---|---|---|---|---|
| **Layout Generation Engine** | Curated database of static handcrafted templates filtered by photo aspect orientations. | Patented **Drop Zones®** dynamic grid system with automatic reflow. | **Stomp Algorithm**: Photos-first dynamic collaging with automatic spacing. | **Algorithmic Recursive BSP + Bipartite Hungarian/Greedy Assignment**: Generates infinite mathematically balanced variations for any $N \in [1..15]$ with zero blank frames. |
| **Layout Cycling** | `A`/`Q` (Left page) and `S`/`W` (Right page) or top template arrows. | Quick Design Picker thumbnail gallery or spacebar shuffle. | `Spacebar` ("Mix It Up!") cycles through arrangement variations. | **`Spacebar` / `Shift+Space`** cycles forward/backward globally; **`S`** shuffles photo assignments within the same layout. HUD badge displays current index (e.g. `3 / 18`). |
| **Storytelling & Batch Flow** | Timeline view with manual page breaks ("cuts") and Auto-Build based on metadata. | Storyteller Auto-Design Wizard: groups by stars, timestamp ranges, and album style presets. | Batch stomping photos sequentially across spreads. | **Orientation & EXIF Cluster Storytelling Engine**: Temporal clustering (>5m, >30m gaps) + cadence pacing (alternates dense detail grids with hero/breathing spreads) for Print Spreads & Social Carousels. |
| **Center Seam & Panorama Handling** | Inside Bleed Fill setting with gutter margin warning; splits spread into two print pages. | Seamless Panorama toggle across spread spine with visual safe guide. | Standard spread stomp with fixed center gutter avoidance. | **Contextual "Set as Seamless Panorama Span"**: Automatically applies split-bleed compensation, adjusts frame bounds, and issues warning if facial details land in the gutter zone. |
| **Divider & Gap Resizing** | Global / spread gap sliders in Inspector; full manual edit requires entering separate "Designer View". | **Direct In-Canvas Divider Dragging**: Grabbing inter-photo space dynamically resizes adjacent drop zones. | Crop box handle resizing; spacing controlled globally via settings menu. | **Interactive In-Canvas Divider Dragging**: Direct Konva hover hit-testing on inter-frame gutters with real-time adjacent boundary rebalancing and undo history snapshot. |
| **Photo Swapping** | Dragging photo thumbnail over another frame swaps contents. | Drag and drop swap between Drop Zones. | Double-click photo to enter selection, then drag onto target to swap. | **Direct Canvas Swap**: Drag photo onto another frame with target highlight ring; exchanges photo asset metadata and focal coordinates instantly. |
| **Template Philosophy** | Curated pre-built templates. Switching templates never deletes photos, but options depend on predefined styles. | Dynamic Drop Zones. Flexible resizing without losing images. | Photos-first Stomps. No empty boxes. | **Zero-Blank Strict Constraint**: All layouts generated dynamically strictly for $N$ photos. Impossible to drop or lose an image during cycling. |

---

## Sources

- **Pixellu SmartAlbums User Manual & Workflow Guides**: Documented template cycling shortcuts (`A`/`Q`, `S`/`W`), Timeline cut segmentation, Inside Bleed Fill mechanism, and Designer View mechanics.
- **Fundy Designer v10/v11 Documentation**: Analyzed Drop Zones 3.0 divider dragging, Auto-Design Wizard timestamp clustering, Quick Design Picker, and Main Image (Hero) weighting.
- **AlbumStomp / Marqueteer (StompSoftware) Knowledgebase**: Analyzed "Mix It Up!" spacebar shuffle paradigm, Stomp Group mechanics, and non-destructive image swapping.
- **OpenSmartAlbum Codebase Analysis**: Audited `src/domain/adaptiveLayout.ts`, `src/stores/albumStore.ts`, `src/features/editor/LayoutCycleHUD.tsx`, and `src/features/editor/KonvaEditorCanvas.tsx`.

---
*Feature research for: OpenSmartAlbum-MacOS Milestone v1.2.0 Unlimited Studio Layout & Storytelling Engine*  
*Researched: 2026-09-23*  
