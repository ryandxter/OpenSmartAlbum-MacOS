# Roadmap: OpenSmartAlbum-MacOS Milestone v1.4.0

## Milestone v1.4.0: Workflow & Canvas Precision Suite

**Milestone Goal:** Deliver studio-grade canvas precision and workflow parity: Direct-Canvas Rich Text Color/Hex bar (v1.2.1 parity), Decorative/Overlay Exclusion in Adaptive Layout (v1.1.17 parity), Quick Guides & Snapping popover, Trackpad/wheel horizontal scrolling drawer, Visual Layers management & reordering panel, and sub-pixel hairline border scaling parity.

---

### Phase Overview

| Phase | Name | Goal | Requirements | Success Criteria |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 18** | **Direct-Canvas Rich Text Color Bar & Inline Hex Editor** | Floating direct-canvas text formatting toolbar with visible Hex inputs (`#RGB`/`#RRGGBB`), text background highlight, mixed-color detection, and selection preservation during color picking. | `TXT-01`, `TXT-02`, `TXT-03`, `TXT-04`, `TXT-05` | 1. Floating toolbar appears above active text selection.<br>2. Typing Hex codes immediately applies color.<br>3. Selection remains highlighted when clicking pickers.<br>4. Bidirectional sync with Inspector. |
| **Phase 19** | **Adaptive Layout Decorative Exclusion & Photo Swap Shortcut** | Flag photo elements (logos, watermarks, stamps) as excluded from adaptive layout reshuffle; enhance keyboard shortcut `S` for swap handle activation and instant 2-frame swap. | `EXC-01`, `EXC-02`, `EXC-03` | 1. `excludeFromAdaptiveLayout` keeps overlays in place on Spacebar shuffle.<br>2. Unlocked photos pack around excluded obstacles.<br>3. Press `S` on 1 photo opens swap handle; press `S` on 2 photos swaps them. |
| **Phase 20** | **Quick Guides & Snapping Popover + Direct Drawer Wheel Scroll** | Quick-access Guides & Snapping popover beside Spread/Post counter in bottom bar; smooth direct horizontal mouse-wheel and trackpad scrolling in thumbnail drawer. | `GUD-01`, `GUD-02`, `NAV-01`, `NAV-02` | 1. Settings button beside counter opens popover.<br>2. Toggle guides, bleed, safe margins, and snap threshold directly.<br>3. Vertical wheel delta scrolls thumbnail drawer horizontally without Shift. |
| **Phase 21** | **Visual Studio Layers Management & Reordering Panel** | Dedicated Studio Layers panel in Inspector/Sidebar with drag-and-drop z-index reordering, multi-selection block drag, midpoint insertion indicator, and lock/hide controls. | `LAY-01`, `LAY-02`, `LAY-03`, `LAY-04` | 1. Studio Layers panel displays all spread elements with type icons.<br>2. Drag-to-reorder updates z-index with single history transaction.<br>3. Multi-selected cards reorder together.<br>4. Lock and hide toggles immediately reflect on canvas. |
| **Phase 22** | **Sub-Pixel Hairline Border Scaling Parity** | Exact proportional scaling and sub-pixel rendering for ultra-thin borders (0.02 - 0.1 mm) across Editor Canvas, Page Navigator thumbnails, and Native Print/Export Preview. | `BOR-01`, `BOR-02` | 1. Micro-borders render proportionally in Export Preview without artificial 2px floor.<br>2. Canvas and thumbnails match high-resolution export geometry exactly. |

---

### Phase Details

#### Phase 18: Direct-Canvas Rich Text Color Bar & Inline Hex Editor
- **Goal:** Provide a Figma/Canva-grade direct-canvas rich text editing experience with real-time Hex inputs and selection preservation.
- **Requirements:** `TXT-01`, `TXT-02`, `TXT-03`, `TXT-04`, `TXT-05`
- **Success Criteria:**
  1. Floating text toolbar renders directly anchored above the active inline text box.
  2. Input fields for Text Color and Text Background accept both `#RGB` and `#RRGGBB` formats with normalization.
  3. Mixed color selections show clear visual "Mixed" feedback instead of incorrect single-color values.
  4. Interacting with color picker popovers does not dismiss the text caret or active text selection.
  5. Formatting operations record into the central history store for single-action Undo/Redo.

#### Phase 19: Adaptive Layout Decorative Exclusion & Photo Swap Shortcut
- **Goal:** Enable decorative logo and watermark overlays to coexist seamlessly with adaptive layout generation, and enhance swap shortcuts.
- **Requirements:** `EXC-01`, `EXC-02`, `EXC-03`
- **Success Criteria:**
  1. Elements marked with `excludeFromAdaptiveLayout: true` stay anchored at their coordinates during Spacebar layout variations.
  2. Adaptive layout geometry algorithm subtracts excluded frames from available partitions.
  3. Single selected photo frame toggles swap ring on `S` keypress; two selected photo frames swap immediately on `S`.

#### Phase 20: Quick Guides & Snapping Popover + Direct Drawer Wheel Scroll
- **Goal:** Improve canvas navigation and layout precision controls with dedicated quick popovers and natural wheel gestures.
- **Requirements:** `GUD-01`, `GUD-02`, `NAV-01`, `NAV-02`
- **Success Criteria:**
  1. Quick popover button in `PageNavigator` and `SlideNavigator` opens a focused guides/snapping control panel.
  2. Users can adjust snapping tolerance and toggle reference lines without leaving their active editing context.
  3. Mouse wheel vertical scroll (`deltaY`) translates into smooth horizontal scrolling (`scrollLeft`) in thumbnail lists.

#### Phase 21: Visual Studio Layers Management & Reordering Panel
- **Goal:** Introduce a comprehensive Studio Layers panel for intuitive z-index and layer visibility management.
- **Requirements:** `LAY-01`, `LAY-02`, `LAY-03`, `LAY-04`
- **Success Criteria:**
  1. Studio Layers panel displays all spread elements with type icons.
  2. Drag-to-reorder updates z-index with single history transaction.
  3. Multi-selected cards reorder together.
  4. Lock and hide toggles immediately reflect on canvas.

#### Phase 22: Sub-Pixel Hairline Border Scaling Parity
- **Goal:** Ensure sub-pixel border fidelity across preview and export modes.
- **Requirements:** `BOR-01`, `BOR-02`
- **Success Criteria:**
  1. Micro-borders render proportionally in Export Preview without artificial 2px floor.
  2. Canvas and thumbnails match high-resolution export geometry exactly.
