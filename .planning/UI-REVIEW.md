# UI / UX AUDIT REPORT: OpenSmartAlbum-MacOS

**Audit Date:** September 22, 2026  
**Auditor:** Antigravity Autonomous UI/UX Auditor (GSD UI Review)  
**Standard:** Apple macOS Human Interface Guidelines (HIG) & Pro Desktop Ergonomics (Adobe Lightroom / InDesign / Pixellu SmartAlbums)  

---

## 1. Visual Contrast & Accessibility (Pillar 1)

### Defect: Invisible Inactive Layout Tiles (WCAG 1.4.3 Contrast Failure)
- **Observed Behavior:** In the Smart Layout panel, when browsing adaptive variations, only the currently active layout thumbnail displays blue rectangles. Inactive cards appear as pitch-black empty squares (`Screenshot 2026-09-22 at 22.06.11.png` & `22.06.00.png`).
- **Pillar Analysis:**
  - Background: `#18181b` (Dark Charcoal)
  - Inactive Rect Fill: `#27272a` (Surface Secondary)
  - Contrast Ratio: **1.14:1** (Far below the minimum 3:1 graphical object contrast requirement in WCAG 2.1).
- **UX Impact:** Users report that the preview tiles are "blank" or non-dynamic, creating the impression that layout variations are failing to load.
- **Recommended Redesign:**
  ```css
  /* Inactive Layout Thumbnails: Crisp Studio Silhouette */
  .miniLayoutRect {
    fill: rgba(255, 255, 255, 0.08);
    stroke: rgba(255, 255, 255, 0.22);
    stroke-width: 1px;
  }
  .miniLayoutCard:hover .miniLayoutRect {
    fill: rgba(255, 255, 255, 0.14);
    stroke: rgba(255, 255, 255, 0.35);
  }
  /* Active Layout Thumbnail: Vibrant Focus */
  .miniLayoutCardActive .miniLayoutRect {
    fill: rgba(59, 130, 246, 0.40);
    stroke: #3b82f6;
    stroke-width: 1.5px;
  }
  ```

---

## 2. Mode Cohesion & Context Awareness (Pillar 2)

### Defect: Social Carousel Mode Displays Print Album Inspector & Empty Canvas
- **Observed Behavior:** When the user switches the top mode toggle to "Social Carousel" (`Screenshot 2026-09-22 at 22.02.45.png`):
  1. The top header shows `Social Carousel` selected.
  2. The bottom bar shows `Slide 1 of 10 | 1080 x 1350 px (4:5)`.
  3. The center canvas displays an empty wide horizontal spread.
  4. The right sidebar states: `Active: Spread 1 (Pages 1-2)` with 84 physical print album layouts.
  5. The user cannot drag or drop photos into the carousel slides.
- **Pillar Analysis:**
  - The application enters a hybrid state where the canvas is running `CarouselCanvas`, but the sidebar and inspector remain tightly bound to `albumStore`.
  - Violates the Principle of Least Astonishment and platform mode consistency.
- **Recommended Redesign:**
  - When `activeMode === 'carousel'`:
    - The right sidebar context badge must read: `Active: Slide 1 (1080 × 1350 px)` or `Active: Slide 1 of 10`.
    - The Layout panel must provide **Carousel-Specific Layout Presets** (e.g., Full Bleed 1-Photo, 2-Photo Split Vertical, 3-Photo Grid, Panoramic Span across Slides 1-2).
    - Dragging photos onto a slide must display a high-contrast blue drop indicator outlining the slide boundary.

---

## 3. Desktop Drag-and-Drop Ergonomics (Pillar 3)

### Defect: Silent Rejection of Finder Files
- **Observed Behavior:** Dragging JPEG/RAW files from a macOS Finder window onto the app window simply snaps the files back to Finder without any visual indicator or tooltip explaining what happened.
- **Pillar Analysis:**
  - macOS desktop apps (Lightroom, Photoshop, InDesign) treat the entire window as an eligible drop target for media files.
  - Silent rejection violates Apple HIG feedback principles.
- **Recommended Redesign:**
  - When files hover over the application window:
    - Display a semi-transparent dark glass overlay with dashed border (`var(--color-primary)`):
    - Icon: `Download` / `FolderPlus`
    - Text: `Drop photos or folders to add to project`
    - Seamlessly trigger non-blocking background thumbnail caching upon drop.

---

## 4. Visual Feedback for Vector Shapes (Pillar 4)

### Defect: Vector Shape Selection Gives False Success Toast without Visual Change
- **Observed Behavior:** Clicking "Hexagon" or "Star" in the Shapes inspector triggers a toast ("Applied hexagon shape"), but the photo on canvas remains completely rectangular.
- **Pillar Analysis:**
  - Disconnect between user expectation and canvas rendering destroys user trust in tool state.
- **Recommended Redesign:**
  - Ensure immediate WYSIWYG vector clipping on the active canvas frame.
  - Display vector shape contour guides when selecting or hovering the frame on canvas.

---

## UI Audit Scorecard

| Dimension | Rating | Status | Notes |
|---|:---:|:---:|---|
| **Visual Hierarchy & Typography** | 9/10 | Pass | SF Pro text, dark graphite studio palette. |
| **Pillar 1: Color Contrast & Clarity** | 4/10 | **FAIL** | Inactive layout tiles are essentially black on black. |
| **Pillar 2: Multi-Mode Cohesion** | 4/10 | **FAIL** | Carousel Mode does not adapt the Inspector or Tray. |
| **Pillar 3: Desktop Ergonomics** | 5/10 | **FAIL** | No window Finder drag-and-drop support. |
| **Pillar 4: Shape Mask WYSIWYG** | 3/10 | **FAIL** | Shape presets do not alter the rendered canvas frame. |
| **Pillar 5: Motion & Transition** | 8/10 | Pass | Smooth pan/zoom and tab transitions. |
| **Pillar 6: Accessibility (ARIA/Focus)**| 8/10 | Pass | Proper ARIA roles on format dialogs and menus. |
