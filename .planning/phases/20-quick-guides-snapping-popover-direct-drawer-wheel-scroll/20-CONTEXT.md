# Phase 20 Context: Quick Guides & Snapping Popover + Direct Drawer Wheel Scroll

## Phase Goal
Improve canvas navigation and precision controls with a dedicated quick popover beside the spread counter and natural horizontal mouse-wheel / trackpad scrolling in thumbnail drawers.

## User Decisions & Locked Scope

### 1. Quick Guides & Snapping Popover
- **Anchor & Button:** Tombol icon gear/slider di samping label `Spread X of Y` (di [PageNavigator.tsx](file:///Users/chiio/VSCode/albumaker/src/features/album/PageNavigator.tsx)) dan `Slide X of Y` (di [SlideNavigator.tsx](file:///Users/chiio/VSCode/albumaker/src/features/carousel/SlideNavigator.tsx)).
- **Popover Contents:**
  - Toggle Canvas Guides Visibility (Spine, Center, Thirds).
  - Toggle Safe Zone Margins & Bleed Lines.
  - Master Magnetic Snapping Switch & Calibrated Distance Threshold (Level 1 - Level 5 / 1mm - 10mm).
  - Snapping Reference Targets (Page Edges, Centers, Margins, Other Frames, Equal Gaps).
- **Context Preservation:** Pengguna dapat mengubah setelan snapping tanpa perlu membuka dialog Full App Settings.

### 2. Direct Wheel & Trackpad Horizontal Scroll
- **Natural Vertical Wheel to Horizontal Scroll:**
  - Menangkap event `wheel` pada container list thumbnail spread/slide.
  - Jika `Math.abs(e.deltaY) > Math.abs(e.deltaX)`, konversikan `deltaY` ke `scrollLeft` secara halus (*smooth scrolling*).
  - Tidak memerlukan tombol `Shift` ditekan.
- **Drag-and-Drop Safety:** Scrolling gesture tidak boleh bentrok atau memicu drag reorder yang tidak disengaja.

## Verification Criteria
- [ ] Tombol quick settings di bar navigator bawah membuka popover Guides & Snapping.
- [ ] Perubahan toggle guides & snapping langsung aktif di kanvas secara real-time.
- [ ] Memutar roda mouse vertikal atau swipe dua jari pada drawer thumbnail menggeser thumbnail secara horizontal.
- [ ] Drag-to-reorder thumbnail tetap berfungsi dengan normal.
