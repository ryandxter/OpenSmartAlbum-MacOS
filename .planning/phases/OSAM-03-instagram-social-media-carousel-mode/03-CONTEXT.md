# Phase 3: Instagram & Social Media Carousel Mode — Context

## Implementation Decisions

### 1. Continuous Wide Canvas Architecture
- **Stage Model**: The carousel is rendered as a single continuous wide Konva stage with total width $= N \times \text{slide\_width}$ and height $= \text{slide\_height}$.
  - Square 1:1: $1080 \times 1080\text{px}$ per slide
  - Portrait 4:5: $1080 \times 1350\text{px}$ per slide
  - Story / Reel 9:16: $1080 \times 1920\text{px}$ per slide
- **Seamless Panorama**: Photos placed across vertical slice boundaries seamlessly bridge adjacent slides without requiring split nodes, cloned elements, or complex masking tricks.
- **Slice Boundary Guides**: Translucent dashed boundary lines with top numbered badges ("Slide 1", "Slide 2", ... "Slide N") are rendered on an overlay layer (non-printable/non-exportable) with magnetic snapping to slide borders.

### 2. Dual-Mode Canvas Engine
- **Mode Toggle**: In the top navigation bar, users can toggle between:
  1. `Print Album`: Uses physical units (mm, cm, inch, 300 DPI), spread page splits, spine gutter, and bleed margin guides.
  2. `Social Carousel`: Uses pixel units (1080px base), seamless continuous stage, and social ratio presets.
- Preserves full undo/redo state and project persistence across mode switches.

### 3. Interactive Slide Management & Live Mobile Simulator
- **Slide Controls**: Add slide (up to 10 slides limit), duplicate slide, delete slide, and drag-and-drop reorder slides via the left sidebar navigator.
- **Phone Swipe Simulator**: An interactive modal popup simulating an iPhone frame with touch/mouse-drag swipe physics, allowing creators to preview and verify seamless transitions across slides prior to export.

---
*Created: 2026-09-22 via /gsd-discuss-phase*
