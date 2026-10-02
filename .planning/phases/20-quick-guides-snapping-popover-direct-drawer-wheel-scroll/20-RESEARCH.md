# Phase 20: Quick Guides & Snapping Popover + Direct Drawer Wheel Scroll - Research Findings

## Executive Summary

Phase 20 streamlines canvas precision control and bottom drawer navigation across both **Print Album** mode and **Social Media Carousel** mode:
1. **Quick Guides & Snapping Popover:** A unified, lightweight, floating popover accessible directly from the bottom navigator bar (beside the spread and slide counters). This gives immediate, one-click access to canvas guide toggles (Spine/Slice, Safe Area, Bleed, Centerlines, Rule of Thirds) and magnetic snapping parameters (Master switch, 5-level distance threshold, and granular target references) without interrupting the creative flow with modal settings dialogs.
2. **Direct Wheel & Trackpad Horizontal Scroll:** Natural, smooth horizontal scrolling in the thumbnail drawers (`PageNavigator` and `SlideNavigator`) by intercepting vertical wheel events (`deltaY`) and translating them to `scrollLeft`, while preserving macOS native two-finger horizontal trackpad momentum and fully protecting drag-and-drop reordering.

---

## 1. Current Guides & Snapping State Architecture

### 1.1 Snapping State (`editorStore.ts` & `editor.ts`)

Magnetic snapping logic is centralized in [`src/stores/editorStore.ts`](file:///Users/chiio/VSCode/albumaker/src/stores/editorStore.ts) and [`src/domain/editor.ts`](file:///Users/chiio/VSCode/albumaker/src/domain/editor.ts).

- **Global Configuration Object (`SnappingConfig`):**
  ```typescript
  export interface SnappingConfig {
    enabled: boolean;
    threshold: number; // In physical mm / canvas units (default: 1.27 mm / 15 px)
    snapToPageEdges: boolean;   // Outer spread borders & spine crease
    snapToPageCenters: boolean; // Optical centerlines of left page, right page, full spread
    snapToMargins: boolean;     // Safe zone margin boundaries (blue dashed)
    snapToFrames: boolean;      // Collinear edges & centers of neighboring frames
    snapToEqualGaps: boolean;   // Equidistant gap spacing & dynamic gap HUD
  }
  ```
- **Calibrated Magnetic Snapping Levels (`SNAPPING_LEVELS`):**
  | Level | Name | Physical Distance (mm) | Screen Distance (px @ 300 DPI) | Description |
  | :---: | :---: | :---: | :---: | :--- |
  | 1 | Soft | 0.85 mm | 10 px | Gentle magnetic pull for micro-adjustments |
  | 2 | Normal | 1.27 mm | 15 px | Standard comfortable alignment (*Default*) |
  | 3 | Medium | 2.96 mm | 35 px | Responsive snapping with broader catch radius |
  | 4 | Strong | 4.23 mm | 50 px | Firm magnetic pull for rapid multi-photo layout |
  | 5 | Max | 6.35 mm | 75 px | Maximum snap distance, locks rapidly to nearest guides |

- **Persistence:**
  - Snapping configuration is loaded on initialization via `loadSavedSnappingConfig()` and saved to `localStorage` under key `afsn_snapping_config` via `saveSnappingConfig(config)`.
  - Store actions: `toggleSnap()`, `updateSnappingConfig(updates: Partial<SnappingConfig>)`.

- **Active Snap Feedback State:**
  - `activeSnapLines: SnapLine[]` (rendered in [`KonvaEditorCanvas.tsx`](file:///Users/chiio/VSCode/albumaker/src/features/editor/KonvaEditorCanvas.tsx#L4322-L4390) as colored lines with coordinate HUD tags).
  - `activeGapGuides: GapGuide[]` (rendered in `KonvaEditorCanvas.tsx` as pink dimension indicator lines and distance pills).

### 1.2 Canvas Visual Guides State

#### A. Print Album Mode (`albumStore.ts` & `KonvaEditorCanvas.tsx`)
- **Existing State in [`albumStore.ts`](file:///Users/chiio/VSCode/albumaker/src/stores/albumStore.ts#L370-L374):**
  - `showGutterGuide: boolean` (Default: `true`): Spine center crease & gutter fold zone.
  - `showBleedGuide: boolean` (Default: `true`): Red outer bleed boundary outline (`bleedGuideBox`).
  - `showSafeAreaGuide: boolean` (Default: `true`): Blue dashed safe margin rectangles per page.
  - `toggleGuide(guide: 'gutter' | 'bleed' | 'safeArea')`: Action to toggle individual guides.
- **Extensions Needed:**
  - `showCenterGuide: boolean` (Default: `false` or `true`): Optical centerlines of left/right page and full spread.
  - `showThirdsGuide: boolean` (Default: `false`): Rule of Thirds 3×3 grid overlay for composition balance.

#### B. Social Media Carousel Mode (`carouselStore.ts` & `CarouselCanvas.tsx`)
- **Existing State in [`carouselStore.ts`](file:///Users/chiio/VSCode/albumaker/src/stores/carouselStore.ts#L36):**
  - `showSliceGuides: boolean` (Default: `true`): Vertical dashed boundary lines between consecutive slides and top badge headers (`Slide 1`, `Slide 2`, etc.).
  - `toggleSliceGuides()` & `setShowSliceGuides(show: boolean)`.
- **Extensions Needed:**
  - `showCenterGuide: boolean` (Default: `false`): Center axes per slide (vertical & horizontal center crosshairs).
  - `showThirdsGuide: boolean` (Default: `false`): Rule of Thirds 3×3 grid per slide.

### 1.3 Synchronization Strategy
- **Snapping Configuration:** Shared across both Print and Carousel modes via `useEditorStore`. Any change in the quick popover immediately takes effect in dragging/resizing calculations regardless of the active workspace mode.
- **Visual Guides:** Mode-aware. When in Print mode, the popover controls Print guides (`showGutterGuide`, `showSafeAreaGuide`, `showBleedGuide`, `showCenterGuide`, `showThirdsGuide`). When in Carousel mode, the popover controls Carousel guides (`showSliceGuides`, `showCenterGuide`, `showThirdsGuide`).
- **Real-Time Canvas Reactivity:** Because `KonvaEditorCanvas` and `CarouselCanvas` subscribe directly to Zustand selectors (`useAlbumStore`, `useCarouselStore`, `useEditorStore`), any toggle in the popover triggers instant zero-latency Konva layer re-rendering without page refresh or modal unmounting.

---

## 2. Bottom Navigator Bar Components & Anchoring

### 2.1 Print Album Navigator: `PageNavigator.tsx`

Located at [`src/features/album/PageNavigator.tsx`](file:///Users/chiio/VSCode/albumaker/src/features/album/PageNavigator.tsx).

- **Structure:**
  ```
  <div className={styles.navigatorContainer}>
    ├── <div className={styles.drawerWrapper}> (Collapsible thumbnail drawer)
    │     └── <div className={styles.drawerList}> (Horizontal scrolling list of Spread thumbnails)
    └── <div className={styles.navigationBar}>
          ├── [Left] Drawer Toggle Button ("Spreads (N)")
          ├── <div className={styles.divider} />
          ├── [Center] Center Controls:
          │     ├── <button> Prev </button>
          │     ├── <select className={styles.spreadSelect}> (e.g. "Spread 1 (Pages 2-3)") </select>
          │     ├── <button> Next </button>
          │     └── [NEW] <button className={styles.quickSettingsBtn}> Guides & Snapping (Icon) </button>
          ├── <div className={styles.divider} />
          └── [Right] Add Spread Button ("+ Add Spread")
  ```
- **Popover Anchor Location:**
  - In `styles.centerControls`, right beside the `spreadSelect` / `Next` button, render the Quick Popover trigger button.
  - Positioning: `position: relative` on the button container; the popover opens upward (`bottom: calc(100% + 8px); left: 50%; transform: translateX(-50%)`).

### 2.2 Carousel Slide Navigator: `SlideNavigator.tsx`

Located at [`src/features/carousel/SlideNavigator.tsx`](file:///Users/chiio/VSCode/albumaker/src/features/carousel/SlideNavigator.tsx).

- **Structure:**
  ```
  <nav className={styles.navigatorContainer}>
    ├── <div className={styles.slidesTrack}> (Horizontal scrolling list of Slide thumbnails)
    └── <div className={styles.actionSection}>
          ├── [Aspect Ratio Selector Buttons: 1:1, 4:5, 9:16]
          ├── <div className={styles.divider} />
          ├── [Move Left / Move Right Buttons]
          ├── [Duplicate / Delete Slide Buttons]
          ├── [Add Slide Button: "Add Slide (N/10)"]
          ├── [NEW] [Quick Guides & Snapping Button]
          ├── <div className={styles.divider} />
          └── [Phone Simulator Button]
  ```
- **Popover Anchor Location:**
  - In `styles.actionSection` or as a dedicated center/counter control, placed beside the slide actions.

---

## 3. Direct Wheel & Trackpad Horizontal Scroll

### 3.1 The Problem with Standard Web Overflow Containers
By default on macOS and Windows, standard mouse wheel rotation emits vertical `WheelEvent` with `deltaY`. When a container has `overflow-x: auto; overflow-y: hidden;`, the browser does **not** route `deltaY` to `scrollLeft` unless the user holds the `Shift` key. This leads to broken or frustrating UX where scrolling over the thumbnail drawer does nothing.

### 3.2 Solution Pattern: Smart Non-Passive Wheel Interceptor

Inspecting [`FilmstripTray.tsx:161-191`](file:///Users/chiio/VSCode/albumaker/src/features/photos/FilmstripTray.tsx#L161-L191) demonstrates the proven, battle-tested solution in this codebase:

```typescript
useEffect(() => {
  const el = scrollContainerRef.current;
  if (!el) return;

  const handleWheel = (e: WheelEvent) => {
    // 1. Guard against Cmd/Ctrl modifier (canvas zoom / browser zoom shortcuts)
    if (e.ctrlKey || e.metaKey) return;

    // 2. Detect dominant vertical wheel rotation vs horizontal trackpad swipe
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();

      // 3. Normalize delta across deltaModes (pixel vs line vs page)
      let delta = e.deltaY;
      if (e.deltaMode === 1) {
        // DOM_DELTA_LINE (standard discrete mouse wheel notches)
        delta *= 40;
      } else if (e.deltaMode === 2) {
        // DOM_DELTA_PAGE
        delta *= 800;
      }

      el.scrollLeft += delta;
    }
  };

  el.addEventListener('wheel', handleWheel, { passive: false });
  return () => {
    el.removeEventListener('wheel', handleWheel);
  };
}, [isDrawerOpen]); // Re-attach when drawer expands/mounts
```

### 3.3 Key Invariants & Edge Cases Handled

1. **Mac Trackpad Smooth Momentum (2-Finger Horizontal Swipe):**
   - When a user performs a 2-finger horizontal swipe on a MacBook trackpad, `Math.abs(e.deltaX) >= Math.abs(e.deltaY)`.
   - The conditional check `Math.abs(e.deltaY) > Math.abs(e.deltaX)` evaluates to `false`.
   - `e.preventDefault()` is **not** called, allowing native macOS hardware-accelerated momentum scrolling and kinetic deceleration on the horizontal axis.
2. **Physical Mouse Wheel Notches (Logitech / Standard Mouse):**
   - Pure vertical wheel rotation produces `deltaY !== 0` and `deltaX === 0`.
   - `deltaY` is translated directly to `el.scrollLeft += delta` with deltaMode normalization.
3. **Drag-and-Drop Safety:**
   - Thumbnail cards use HTML5 drag-and-drop (`draggable={true}`, `onDragStart`, `onDragOver`, `onDrop`).
   - Native drag-and-drop operations are initiated by pointer mouse down + drag movement threshold, which are completely separate from `WheelEvent`.
   - Adding a non-passive `wheel` listener does not affect `dragstart`, `dragover`, or `drop` events.
4. **Boundary Clamping:**
   - Setting `el.scrollLeft += delta` is natively clamped by the browser between `0` and `el.scrollWidth - el.clientWidth`.

---

## 4. Popover Component Design & Architecture

### 4.1 UI Layout & Structure

Create a dedicated component [`QuickGuidesPopover.tsx`](file:///Users/chiio/VSCode/albumaker/src/features/editor/QuickGuidesPopover.tsx) (and accompanying CSS module).

```
┌────────────────────────────────────────────────────────┐
│  Quick Guides & Snapping                         [×]   │
├────────────────────────────────────────────────────────┤
│  CANVAS GUIDES                                         │
│  [■] Center Spine Crease (Gutter)        [ Switch: ON ]│
│  [■] Safe Area Margins (Blue dashed)     [ Switch: ON ]│
│  [■] Bleed Cut Boundary (Red outline)    [ Switch: ON ]│
│  [■] Optical Centerlines                 [ Switch: OFF]│
│  [■] Rule of Thirds Grid (3×3)           [ Switch: OFF]│
├────────────────────────────────────────────────────────┤
│  MAGNETIC SNAPPING                                     │
│  Enable Magnetic Snapping                [ Switch: ON ]│
│                                                        │
│  Attraction Distance Threshold:                        │
│  ┌─────────┬─────────┬─────────┬─────────┬──────────┐  │
│  │ Level 1 │ Level 2 │ Level 3 │ Level 4 │ Level 5  │  │
│  │  Soft   │ Normal  │ Medium  │ Strong  │   Max    │  │
│  └─────────┴─────────┴─────────┴─────────┴──────────┘  │
│  ℹ Level 2 • Normal (15 px / 1.27 mm) - Recommended   │
├────────────────────────────────────────────────────────┤
│  REFERENCE TARGETS                                     │
│  [■] Page & Spine Outer Edges            [ Switch: ON ]│
│  [■] Page Optical Centerlines            [ Switch: ON ]│
│  [■] Safe Zone Margin Boundaries         [ Switch: ON ]│
│  [■] Adjacent Photo Frame Edges          [ Switch: ON ]│
│  [■] Equidistant Gap Spacing             [ Switch: ON ]│
└────────────────────────────────────────────────────────┘
```

### 4.2 Interaction Details & Accessibility

- **Outside Click Dismissal:**
  - Standard `pointerdown` listener on `document` checking `!popoverRef.current.contains(e.target) && !triggerRef.current.contains(e.target)`.
- **Keyboard Dismissal:**
  - `Escape` key closes the popover and restores focus to the trigger button.
- **Shortcuts:**
  - Shortcut key `G` or `Shift+G` can toggle the quick popover.
  - Shortcut key `S` toggles Master Snapping ON/OFF (already implemented in StatusBar).
- **Glassmorphic Theme Integration:**
  - Uses CSS tokens: `var(--color-surface)`, `var(--color-bg-primary)`, `var(--color-accent)`, `var(--color-border)`.
  - Elevation: `z-index: 50`, `box-shadow: 0 16px 36px rgba(0, 0, 0, 0.55), 0 0 0 1px var(--color-border)`.

---

## 5. Canvas Guide Rendering Details

### 5.1 Centerlines Guide (`showCenterGuide`)
- **Print Mode ([`KonvaEditorCanvas.tsx`](file:///Users/chiio/VSCode/albumaker/src/features/editor/KonvaEditorCanvas.tsx)):**
  - Horizontal Centerline across full spread: `y = (spreadH / 2) * scaleFactor`.
  - Left Page Vertical Centerline: `x = (pageW / 2) * scaleFactor`.
  - Right Page Vertical Centerline: `x = (pageW + gutterW + pageW / 2) * scaleFactor`.
  - Spread Vertical Centerline (Spine): `x = (spreadW / 2) * scaleFactor`.
  - Rendered with distinct color (e.g. `rgba(168, 85, 247, 0.65)` purple dashed line `dash={[5, 5]}`).
- **Carousel Mode ([`CarouselCanvas.tsx`](file:///Users/chiio/VSCode/albumaker/src/features/carousel/CarouselCanvas.tsx)):**
  - For each slide:
    - Slide Vertical Centerline: `x = xOffset + slideWidthPx / 2`.
    - Slide Horizontal Centerline: `y = slideHeightPx / 2`.

### 5.2 Rule of Thirds Guide (`showThirdsGuide`)
- **Print Mode:**
  - For Left Page:
    - Vertical lines at `x = (pageW * 1/3) * scaleFactor` and `x = (pageW * 2/3) * scaleFactor`.
    - Horizontal lines at `y = (pageH * 1/3) * scaleFactor` and `y = (pageH * 2/3) * scaleFactor`.
  - For Right Page:
    - Vertical lines at `x = (pageW + gutterW + pageW * 1/3) * scaleFactor` and `x = (pageW + gutterW + pageW * 2/3) * scaleFactor`.
    - Horizontal lines at `y = (pageH * 1/3) * scaleFactor` and `y = (pageH * 2/3) * scaleFactor`.
  - Rendered with fine dashed line (e.g. `rgba(56, 189, 248, 0.4)` cyan dashed `dash={[4, 4]}`).
- **Carousel Mode:**
  - For each slide:
    - Vertical lines at `x = xOffset + slideWidthPx / 3` and `x = xOffset + (slideWidthPx * 2) / 3`.
    - Horizontal lines at `y = slideHeightPx / 3` and `y = (slideHeightPx * 2) / 3`.

---

## 6. Verification & Implementation Plan

### 6.1 Planned Changes
1. **Store Enhancements:**
   - Add `showCenterGuide: boolean` and `showThirdsGuide: boolean` to [`albumStore.ts`](file:///Users/chiio/VSCode/albumaker/src/stores/albumStore.ts) and [`carouselStore.ts`](file:///Users/chiio/VSCode/albumaker/src/stores/carouselStore.ts), with corresponding toggle actions.
2. **Component Implementation:**
   - Create [`src/features/editor/QuickGuidesPopover.tsx`](file:///Users/chiio/VSCode/albumaker/src/features/editor/QuickGuidesPopover.tsx) and [`src/features/editor/QuickGuidesPopover.module.css`](file:///Users/chiio/VSCode/albumaker/src/features/editor/QuickGuidesPopover.module.css).
3. **Navigator Integration:**
   - Integrate the popover trigger button and popover component into [`PageNavigator.tsx`](file:///Users/chiio/VSCode/albumaker/src/features/album/PageNavigator.tsx) beside `spreadSelect`.
   - Integrate into [`SlideNavigator.tsx`](file:///Users/chiio/VSCode/albumaker/src/features/carousel/SlideNavigator.tsx) in the controls bar.
4. **Direct Wheel Scrolling:**
   - Implement non-passive `wheel` event listeners on `drawerList` in [`PageNavigator.tsx`](file:///Users/chiio/VSCode/albumaker/src/features/album/PageNavigator.tsx) and `slidesTrack` in [`SlideNavigator.tsx`](file:///Users/chiio/VSCode/albumaker/src/features/carousel/SlideNavigator.tsx).
5. **Canvas Rendering:**
   - Add Centerlines and Rule of Thirds rendering to [`KonvaEditorCanvas.tsx`](file:///Users/chiio/VSCode/albumaker/src/features/editor/KonvaEditorCanvas.tsx) and [`CarouselCanvas.tsx`](file:///Users/chiio/VSCode/albumaker/src/features/carousel/CarouselCanvas.tsx).
6. **Automated Unit Tests:**
   - Create unit tests covering popover state management, store updates, wheel delta conversions, and canvas guide toggle behaviors.

---

## Conclusion
The architecture is clear, consistent with existing codebase conventions (`FilmstripTray`, `SettingsDialog`, `KonvaEditorCanvas`), and designed for instant real-time responsiveness without unnecessary modal overhead.
