# Phase 16 Context: Workspace Isolation & Mode State Synchronization

**Phase Goal:** Establish clean workspace isolation between Print Album and Social Carousel environments by hoisting `activeMode` to global state, isolating zoom levels, mode-guarding title bar controls and keyboard shortcuts, and preventing frame coordinate detachment during slide reordering or layout cycling.

---

## 1. Locked Implementation Decisions

### 1.1 Project Mode Definition & Header UI
- **Explicit Project Creation Wizard:** `NewProjectDialog` features distinct tabs for `"Print Album"` (physical dimensions mm/in, spread architecture) and `"Social Carousel"` (pixel dimensions, 1:1 / 4:5 / 9:16 aspect ratios).
- **Title Bar Mode Indicator:** The Mode Switcher in `AppTitleBar` operates as a distinct project-type badge (e.g. `Print Album` or `Social Carousel`). Converting between types is handled explicitly via "File > Duplicate as Carousel / Print Album".
- **Global `activeMode` State:** Hoisted into `appStore`, resolved deterministically on project load (`canvas.unit === 'px'` $\to$ `'carousel'`, else `'print'`).

### 1.2 Viewport & Camera Navigation
- **Zoom Reset Strategy:** Automatically resets viewport zoom to 100% / fit-to-screen upon project loading or mode transitions, avoiding jarring coordinate/scale jumps across unit systems.

### 1.3 Canvas Frame Geometry Maintenance on Slide Operations
- **Slide Reorder / Deletion / Duplication:** When slides are shifted, deleted, or cloned, `carouselStore` automatically recalculates and shifts the absolute $x$ coordinates of all contained photo frames by the exact slide offset delta ($\pm(\text{width} + \text{gap})$), preventing detached or orphaned frames.

### 1.4 Mode-Guarded Title Bar & Shortcut Routing
- **Undo / Redo Routing:** Title bar undo/redo arrows and global shortcuts (`Cmd+Z`, `Cmd+Shift+Z`) route through a centralized dispatcher that delegates exclusively to `carouselStore.undo/redo()` in Carousel mode and `editorStore.undo/redo()` in Print mode.
- **Add Text Action:** Clicking "Add Text" in Carousel mode spawns a native Konva Text Frame centered on the active slide (e.g. 48px SF Pro, high contrast) and records a discrete history undo entry, rather than dispatching to `albumStore.addTextToSpread`.
- **Keyboard Shortcut Scoping:** Single-key accelerators (`T`, `L`, `G`, `P`, `Space`) are filtered through a central mode guard that suppresses irrelevant print shortcuts when in Carousel mode.

### 1.5 Frame Style Preservation During Layout Mutations
- **Preserve Shapes & Borders:** Dynamic layout cycling (`Spacebar`) and auto-flow algorithms update only spatial attributes ($x, y, \text{width}, \text{height}$) while strictly preserving existing `shapeType`, `border` parameters, `shadow` definitions, and `cornerRadii`.

---

## 2. Requirements Mapped to Phase 16
- `ISO-01`: Global `activeMode` in `appStore` with auto-detection on project open.
- `ISO-02`: Clean zoom/pan isolation across modes with fit-to-screen initialization.
- `ISO-03`: Title bar controls (Undo/Redo, "Add Text", Export) and shortcuts dispatch strictly to active mode.
- `ISO-04`: Automatic frame $x$ offset adjustment on slide reorder, deletion, or duplication.
- `ISO-05`: Preserved shape masks, borders, and corner radii during layout cycling and auto-flow.
