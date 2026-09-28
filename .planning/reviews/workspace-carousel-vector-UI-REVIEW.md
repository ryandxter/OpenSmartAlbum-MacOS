# OpenSmartAlbum: 6-Pillar UI/UX Audit Report
**Focus Area:** Workspace Switcher, Social Carousel Canvas & Navigator, Filmstrip Tray & Batch Operations, Vector Shape Masking Inspector  
**Audit Date:** September 2026  
**Auditor:** GSD UI/UX Auditor Subagent  
**Evaluation Standard:** macOS Human Interface Guidelines (HIG), WCAG 2.1 AA/AAA, Design System Consistency  

---

## Executive Summary & Scorecard

This comprehensive audit evaluates the visual hierarchy, interaction ergonomics, microcopy fidelity, platform compliance, edge-case robustness, and accessibility of OpenSmartAlbum's workspace header, carousel editor, photo tray, and inspector components.

| Pillar | Grade | Status | Key Highlights / Blockers |
| :--- | :---: | :---: | :--- |
| **1. Visual Hierarchy & Spacing Rhythm** | **B+ (86%)** | Pass with Notes | Clean 44px toolbar and dark theme balance; right toolbar gets overcrowded at <1080px; subtle active mode pill contrast. |
| **2. Interaction Feedback & Drag-and-Drop UX** | **B (82%)** | Pass with Notes | DOM-attached drag ghost badge prevents WebKit cancellation; clear blue slide drop highlight; **Gap:** No hover highlight on existing frames for replace action during file drag; SlideNavigator cards do not accept drops. |
| **3. Typography & Microcopy** | **C+ (77%)** | **Defects Found** | **P0 Defect:** `PhotoContextMenu` is mode-unaware, displaying "Place on Spread Canvas" and inserting into the print album even in Carousel mode; tooltips across batch operations need mode-conditional labels. |
| **4. Platform Conformance (macOS HIG)** | **A- (90%)** | Pass | Strict 80px traffic light inset; proper `-webkit-app-region` drag partitioning; standard macOS SF Pro / symbol conventions; **Gap:** Media query hides Mode Switcher completely at <900px. |
| **5. Component States & Edge Cases** | **B- (80%)** | Pass with Notes | Excellent multi-selection transformer and arrow nudging; **P0 Defect:** "Add Text" in Titlebar calls `addTextToSpread` without carousel support; Corner radius slider unconditionally resets unlinked inputs when dragged. |
| **6. Accessibility & Contrast** | **B+ (87%)** | Pass | High text contrast on `#18181B` / `#1E1E22` surfaces; full keyboard support on slide cards; **Gap:** Mode switcher active state contrast ratio (~1.2:1) is too low against its container; dropdown menus lack ARIA menu item role traps. |
| **OVERALL COMPOSITE** | **B (83.7%)** | **Production Ready with Minor Patches** | High functional execution with two critical mode-routing gaps requiring immediate remediation. |

---

## Pillar 1: Visual Hierarchy & Spacing Rhythm

### 1.1 AppTitleBar (`src/features/workspace/AppTitleBar.tsx`)
- **Structure & Alignment:** Three-column layout (`leftSection`, `centerSection`, `rightSection`) within a fixed 44px height bar.
- **Visual Weight Distribution:**
  - Left section (File/Help menus, History buttons) uses lightweight `ghost` styling, keeping visual weight neutral.
  - Center section features a pill badge with real-time status indicators (saved green `#10B981` vs unsaved amber `#F59E0B` with glow). Project name truncates cleanly with ellipsis (`max-width: clamp(140px, 22vw, 280px)`).
  - Right section hosts the Mode Switcher (`Print Album` vs `Social Carousel`), Zoom controls, `Add Text`, `Export`, and `Properties` toggle.
- **Rhythm & Spacing Inconsistencies:**
  - The spacing between groups in the right section is tightly constrained (`gap: 6px`).
  - At window widths under 1080px, `.zoomControls` are hidden via CSS media query (`display: none`). At under 900px, `.modeSwitcher` is hidden entirely (`display: none`). This abruptly eliminates the user's ability to switch workspaces.
  - The "Add Text" button uses `font-weight: 600` and a white tint border, competing with the primary "Export" button for visual dominance.

### 1.2 Carousel Canvas (`src/features/carousel/CarouselCanvas.tsx`)
- **Stage Staging:** Centralized infinite canvas against deep zinc `#18181B`. Slide canvas utilizes a soft 30px blur drop shadow (`rgba(0, 0, 0, 0.4)`), clearly delineating active artwork bounds from viewport margins.
- **Slice & Cut Guides:**
  - Slide boundary cuts across spanning frames use cyan dashed rules (`rgba(56, 189, 248, 0.75)`) and dark floating badges reading `"Slide Cut"`.
  - Boundary lines between individual slides use 1.5px dashed rules (`rgba(255, 255, 255, 0.4)`) with an anchored `"Slide X"` label badge in the top-left corner (`rgba(0, 0, 0, 0.65)`).
  - Visual hierarchy cleanly isolates guides to an overlay layer (`listening={false}`), preventing pointer interception.

### 1.3 Slide Navigator (`src/features/carousel/SlideNavigator.tsx`)
- **Geometry & Rhythm:** Standardized 80px bottom bar with horizontal scrolling track. Slide cards dynamically adopt the active aspect ratio (`1:1`, `4:5`, `9:16`) at a fixed height of 56px.
- **Status Badges:** Active slide card is highlighted with `var(--color-accent, #E4E4E7)` border and `1.5px` focus ring. Micro-thumbnails inside `MiniSlidePreview` retain relative aspect and positions accurately.
- **Controls Clustering:** Reorder arrows, duplicate, delete, and ratio selector pills are logically grouped on the right with vertical hairline dividers (`1px solid #2E2E33`).

---

## Pillar 2: Interaction Feedback & Drag-and-Drop UX

### 2.1 Drag Ghost Badging
- **Implementation:** Both `FilmstripTray.tsx` (lines 370–393) and `BatchActionBar.tsx` (lines 109–132) construct a dedicated DOM element `#afsn-drag-ghost-badge` attached to `document.body` at `-1000px, -1000px`.
- **Feedback Quality:**
  - Single photo drag: Renders filename with dark background `#0F172A`, cyan border `#38BDF8`, and soft shadow.
  - Multi-photo drag: Renders `📁 X Photos Selected`.
  - Passing this DOM element to `e.dataTransfer.setDragImage(badge, 20, 16)` guarantees that WebKit (macOS Tauri) does not drop the drag session or produce an ugly clipped preview.

### 2.2 Drop Target Highlighting (Canvas vs Frames)
- **Slide Drop Target:** In `CarouselCanvas.tsx` (`handleDragOver`), continuous canvas X is converted to slide index (`getSlideIndexAtX`). The hovered slide renders a blue dashed border:
  ```tsx
  {hoveredDropSlideIndex === idx && (
    <Rect width={slideWidth} height={totalHeight} stroke="#3B82F6" strokeWidth={3} dash={[8, 8]} />
  )}
  ```
- **Frame Replacement Gap (Critical Interaction Void):**
  - In `handleDrop`, if the user releases the pointer over an existing photo frame, it correctly detects the frame hit box and replaces the image (`updatePhotoFrame`).
  - **However, during `handleDragOver`, there is NO visual hover state on the target photo frame!** The user only sees the blue outline around the entire slide. There is no indication (such as an inner cyan border or replacement tooltip) that dropping at that specific coordinate will overwrite an existing photo rather than insert a new frame.
- **In-Canvas Frame Swapping:**
  - When dragging an existing Konva frame (`onDragMove`), `findPhotoSwapTarget` calculates proximity and displays a cyan pulsing highlight ring (`#38BDF8`, lines 1114–1129) over the swap recipient. This provides interaction feedback for internal moves, but external tray drags lack this fidelity.

### 2.3 Insertion Feedback & SlideNavigator Drops
- **Multi-Photo Insertion:** Dropping multiple photos partitions them into a clean 1- or 2-column grid (`margin = 40, spacing = 16`).
- **Slide Navigator Drop Inability:**
  - In `SlideNavigator.tsx`, slide preview cards do not bind `onDragOver` or `onDrop`.
  - Dragging photos directly from the filmstrip onto slide cards in the navigator fails silently. Users intuitively expect bottom tray slide thumbnails to act as drop targets.

---

## Pillar 3: Typography & Microcopy

### 3.1 "Place on Slide" vs "Place on Spread" (Mode Inconsistency)
- **Problem Statement:** In `src/features/photos/PhotoContextMenu.tsx` (lines 122–141), the context menu action is hardcoded:
  ```tsx
  {/* Current implementation */}
  <span>{isMulti ? `Place ${count} Photos on Spread` : 'Place on Spread Canvas'}</span>
  ```
  - Clicking this button accesses `useAlbumStore.getState()` and `useEditorStore.getState().addPhotosToSpread(activeSpread.id, ...)`.
  - When the user is working in **Social Carousel Mode**, the context menu continues to display "Place on Spread Canvas", and executing the action places the photo into an inactive background print album spread, producing zero feedback on the visible carousel canvas!
- **Double-Click Microcopy & Behavior Comparison:**
  - In `FilmstripTray.tsx` (lines 765–818), double-clicking a thumbnail checks `if (activeMode === 'carousel')` and adds a `CarouselPhotoFrame` to the active slide.
  - Hover tooltips on filmstrip cards (lines 830–833) correctly branch:
    `(Placed in ${activeMode === 'carousel' ? 'carousel slide' : 'album spread'} — Double-click to place again...)`.
  - `PhotoContextMenu.tsx` was omitted from this mode-awareness refactor, creating a severe functional disconnect.

### 3.2 Microcopy in Vector Masking & Navigator
- **Shapes & Borders:**
  - Preset labels ("Rect", "Rounded", "Circle", "Hexagon", "Octagon", "Star", "Scallop", "Heart", "SVG Mask") are short, recognizable, and legible.
  - Link/Unlink tooltip clearly toggles: `Corners Linked (Uniform)` vs `Corners Independent`.
- **Slide Counter:** Navigator shows `Add Slide (X/10)` and disables at `MAX_CAROUSEL_SLIDES (10)` with explicit tooltip `Maximum 10 slides reached`.

---

## Pillar 4: Platform Conformance (macOS Human Interface Guidelines)

### 4.1 Window Chrome & TitleBar Inset
- **Traffic Light Clearance:**
  - macOS window control buttons (close/minimize/zoom) sit at the top-left of the Tauri window.
  - `AppTitleBar.module.css` sets:
    ```css
    padding-left: var(--mac-traffic-light-inset, 80px);
    height: var(--toolbar-height, 44px);
    -webkit-app-region: drag;
    ```
  - Interactive child components (menus, history, title input) explicitly declare `-webkit-app-region: no-drag`, preventing window drag capture when clicking buttons.
  - Left margin ensures 80px of clean buffer space, fully respecting macOS traffic light bounds.

### 4.2 Segmented Mode Switcher
- **HIG Compliance:** Mode switcher (`.modeSwitcher`) uses an inset grouped control styling (`background: #27272A`, `border: 1px solid #2E2E33`, `border-radius: 6px`, `padding: 2px`).
- **Icons & Labels:** Pairing Lucide `BookOpen` (Print Album) and `Layers` (Social Carousel) matches macOS standard toolbar visual vocabulary (similar to Pages/Keynote view switchers).
- **Responsive Breakpoint Failure:**
  - In `AppTitleBar.module.css` (lines 534–538):
    ```css
    @media (max-width: 900px) {
      .modeSwitcher { display: none; }
    }
    ```
  - Completely removing the mode switcher on compact windows violates macOS HIG for primary navigation. On a 13-inch display with split screen (width ~720px), the user cannot switch modes. The control should instead collapse to an icon-only segmented pill or dropdown.

### 4.3 Typography & Shortcuts
- Font stack correctly targets `-apple-system, BlinkMacSystemFont, "SF Pro Text"`.
- Keyboard shortcuts accurately reflect Mac glyphs: `⌘N`, `⌘O`, `⌘S`, `⌘⇧S`, `⌘E`, `⌘,`, `⌘Z`, `⌘⇧Z`, `⌘0`, `⌘A`.

---

## Pillar 5: Component States & Edge Cases

### 5.1 Vector Shape Masking Inspector UI (`ShapesBordersSection.tsx`)
- **Shape Presets & Corner Radius Conditioning:**
  - Lines 302–374: The Corner Radius slider and individual inputs (TL, TR, BR, BL) are only rendered when:
    ```tsx
    (currentShape === 'rectangle' || currentShape === 'rounded')
    ```
  - When presets like `Circle`, `Hexagon`, `Star`, `Heart`, or `Scallop` are active, the corner radius control is hidden. This is mathematically correct since geometric regular polygons and Bézier contours do not support arbitrary 4-corner box radii.
  - **Edge Case Defect:** If a user unlinks corners (`isCornersLinked = false`) and configures independent radii (`TL: 24, TR: 0, BR: 24, BL: 0`), and subsequently scrubs the "Master Corner Radius" slider, `handleMasterRadiusChange` overwrites all four corners with the uniform slider value without setting `isCornersLinked` back to `true`. When the user looks at the unlinked input grid, all values have been altered without visual warning.
- **Carousel Frame Store Integration:**
  - `ShapesBordersSection.tsx` correctly handles `activeMode === 'carousel'` by dispatching to `useCarouselStore.getState().updatePhotoFrame`.
  - Corner radii are parsed from `cornerRadiusTl`, `cornerRadiusTr`, `cornerRadiusBr`, `cornerRadiusBl`, or fallback `cornerRadius`.

### 5.2 Multi-Selection & Transformer
- In `CarouselCanvas.tsx`:
  - `Transformer` cleanly attaches to multiple Konva nodes (`trRef.current.nodes(nodes)`).
  - Multi-node dragging maintains relative offsets using `dragInitialPositionsRef`.
  - Arrow key nudging (`ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight` with `Shift` for 10px steps) computes batch delta updates across all selected frames in all carousel slides.
  - Delete/Backspace dispatches `deleteSelectedFrames()` on the carousel store rather than the album store.

### 5.3 Mode Switcher Action Disconnect: "Add Text"
- In `AppTitleBar.tsx` (lines 484–499):
  ```tsx
  <button
    onClick={() => {
      if (!activeSpreadId) return;
      const newId = addTextToSpread(activeSpreadId);
      if (newId) { ... }
    }}
  >
    Add Text
  </button>
  ```
  - When `activeMode === 'carousel'`, clicking "Add Text" in the TitleBar does nothing if `activeSpreadId` is unset, or adds text to a hidden album spread.
  - It does not invoke carousel text creation, misleading the user.

---

## Pillar 6: Accessibility & Contrast

### 6.1 Contrast Ratio Verification (WCAG 2.1)
- **Backgrounds & Text:**
  - Canvas surface `#18181B` with Primary text `#F4F4F5` -> **14.2:1** (Passes AAA).
  - TitleBar `#1E1E22` with Secondary text `#A1A1AA` -> **6.5:1** (Passes AA).
  - Tertiary metadata `#71717A` against `#1E1E22` -> **3.8:1** (Below 4.5:1 threshold; acceptable only for disabled/secondary captions, but borderline for file dimensions in context menus).
- **Segmented Mode Switcher Contrast:**
  - Inactive button background: `transparent` on `#27272A`.
  - Active button background: `#1E1E22` on `#27272A`.
  - Contrast ratio between active pill and container is **1.2:1**. The visual distinction is almost entirely dependent on text color brightness (`#F4F4F5` vs `#A1A1AA`) and subtle drop shadow. Users with low contrast perception may struggle to identify which mode is selected.

### 6.2 ARIA & Keyboard Traversal
- `SlideNavigator.tsx`:
  - Slide cards declare `role="button"`, `tabIndex={0}`, and handle `Enter` and `Space` keyboard activation.
  - The container declares `aria-label="Carousel Slide Navigator"`.
- `BatchActionBar.tsx`:
  - Uses `role="status"` for temporary copy notifications.
  - Copy button has `aria-live="polite"`.
- `PhotoContextMenu.tsx`:
  - Positioned via React Portal (`document.body`).
  - Listens for `Escape` and outside pointer clicks.
  - Missing proper ARIA `role="menu"` and `role="menuitem"` hierarchy for screen readers.

---

## Summary of Critical Interaction Gaps & Action Items

### P0 — Critical Functional / Mode Gaps (Fix Immediately)
1. **Filmstrip Context Menu Mode Blindness:**
   - **File:** `src/features/photos/PhotoContextMenu.tsx` & `FilmstripTray.tsx`
   - **Issue:** Context menu hardcodes "Place on Spread Canvas" and calls `addPhotosToSpread`. In Carousel mode, this fails to place photos on the active carousel slide and mutates background album state.
   - **Remediation:** Pass `activeMode` into `PhotoContextMenu`. If `activeMode === 'carousel'`, label must read `"Place on Active Slide"` (or `"Place X Photos on Slide"`) and invoke `useCarouselStore.getState().addPhotoFrame(...)`.
2. **TitleBar "Add Text" Mode Blindness:**
   - **File:** `src/features/workspace/AppTitleBar.tsx`
   - **Issue:** "Add Text" button checks `!activeSpreadId` and calls `addTextToSpread`. In Carousel mode, it is completely non-functional or mutates the album.
   - **Remediation:** Branch onClick based on `activeMode`. In Carousel mode, route to carousel text box placement or disable with a tooltip.

### P1 — High-Priority Interaction Gaps
1. **Drop Target Feedback for Frame Replacement:**
   - **File:** `src/features/carousel/CarouselCanvas.tsx`
   - **Issue:** When dragging a photo from the filmstrip over an existing frame on the canvas, only the general slide blue border appears. The user cannot tell that releasing will replace the frame's content.
   - **Remediation:** In `handleDragOver`, calculate if `canvasX, canvasY` hits any unlocked `allFrames`. If so, set a `hoveredDropReplaceFrameId` and render a cyan/amber replacement ring over the frame.
2. **SlideNavigator Drag Target Support:**
   - **File:** `src/features/carousel/SlideNavigator.tsx`
   - **Issue:** Users cannot drag photos onto slide cards in the bottom navigator.
   - **Remediation:** Add `onDragOver` and `onDrop` handlers to `SlideCard` in `SlideNavigator.tsx` to insert dropped photos directly into the targeted slide index.
3. **Mode Switcher Responsive Collapse:**
   - **File:** `src/features/workspace/AppTitleBar.module.css`
   - **Issue:** Hiding `.modeSwitcher` at `<900px` locks users out of changing modes on smaller displays.
   - **Remediation:** Replace `display: none` with an icon-only display rule (hiding text spans while retaining the segmented icons).

### P2 — Visual Refinements & Accessibility
1. **Mode Switcher Active Indicator Contrast:**
   - **File:** `src/features/workspace/AppTitleBar.module.css`
   - **Remediation:** Add a crisp border (`border: 1px solid var(--color-border-subtle)`) or a bottom accent pip / brighter fill (`rgba(255, 255, 255, 0.12)`) to `.modeActive` to meet WCAG visual boundary standards.
2. **Unlinked Corner Radius Slider Sync:**
   - **File:** `src/features/inspector/sections/ShapesBordersSection.tsx`
   - **Remediation:** When scrubbing the master slider while `isCornersLinked` is `false`, automatically toggle `isCornersLinked` to `true` or constrain the slider to act as a relative offset.
