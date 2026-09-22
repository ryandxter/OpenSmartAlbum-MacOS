# Phase 3 Technical Research: Instagram & Social Media Carousel Mode

**Phase**: OSAM-03-instagram-social-media-carousel-mode  
**Date**: 2026-09-22  
**Status**: Completed  
**Author**: Lead Systems Engineer & Codebase Architect  

---

## 1. Executive Summary & Problem Formulation

OpenSmartAlbum currently operates strictly in a physical print album layout paradigm (`Spread` containing `leftPage`, spine `gutterWidth`, `rightPage`, and physical units `mm`, `cm`, `inch` at a configured DPI).

Instagram and social media carousel posts require a fundamentally different digital canvas:
1. **Pixel-Perfect Digital Dimensions**: Fixed target resolutions without physical DPI scaling:
   - Square 1:1: `1080 × 1080 px`
   - Portrait 4:5: `1080 × 1350 px`
   - Story / Reel 9:16: `1080 × 1920 px`
2. **Continuous Panoramic Stage**: Multi-panel seamless carousels (2 to 10 slides). In Adobe InDesign or Canva, users need to span a wide panoramic photo across slide boundaries (e.g. from Slide 1 into Slide 2) without manually slicing the image into separate elements.
3. **Dual-Mode Canvas Engine**: The user can toggle between "Print Album" and "Social Carousel" instantly in the top navigation titlebar, with distinct inspectors, guides, and navigators.
4. **Slide Navigation & Mobile Simulation**: Reordering slides (up to 10 slides), duplicating, deleting, and testing the swipe experience in a simulated phone viewport prior to export.

---

## 2. Architecture & Data Model Analysis

### 2.1 Existing Model vs Carousel Model
- `Project` in `src/domain/project.ts`:
  Contains `canvasWidth`, `canvasHeight`, `canvasUnit`, `canvasDpi`, `spacingValue`, `marginEnabled`, etc.
- `Album` in `src/domain/album.ts`:
  Contains `coverSpread: Spread`, `spreads: Spread[]`, `totalSpreads`, `totalPages`.
  A `Spread` is physically bound to left/right pages with a central spine gutter.

### 2.2 Independent Carousel Model (`src/domain/carousel.ts`)
Rather than corrupting the physical print album structures (`Spread`, `Page`) with hacky flags, a clean, modular `Carousel` domain is introduced:
- `CarouselRatio`: `'1:1' | '4:5' | '9:16'`
- `CarouselSlide`: Slide definition with `slideIndex`, `widthPx`, `heightPx`, `backgroundColor`, and `elements: CarouselPhotoFrame[]`.
- `CarouselPhotoFrame`: Frame elements positioned in continuous canvas coordinates (`x` can range from `0` to `totalSlides * slideWidthPx`).
- `Carousel`: Root aggregate containing `projectId`, `ratio`, `slideWidthPx`, `slideHeightPx`, and `slides: CarouselSlide[]`.

### 2.3 State Management (`src/stores/carouselStore.ts`)
A dedicated Zustand store `useCarouselStore` manages:
- `currentCarousel: Carousel | null`
- `activeSlideIndex: number`
- Slide CRUD actions: `addSlide` (enforcing max 10 limit), `duplicateSlide`, `deleteSlide` (enforcing min 1 limit), `reorderSlide`
- Ratio switching: recalculates slide dimensions while maintaining element continuity
- Frame updates: positioning, cropping, locking

---

## 3. Canvas & Viewport Mechanics

### 3.1 Continuous Stage Math
In `src/domain/viewport.ts`:
`calculatePasteboardViewport` takes `spreadWidth` and `spreadHeight`.
For a carousel:
- `totalWidth = carousel.slideWidthPx * carousel.slides.length`
- `totalHeight = carousel.slideHeightPx`
The same pasteboard calculations and pan/zoom math apply seamlessly.

### 3.2 Slice Boundary Guides & Snapping
On the Konva Stage:
- Slice boundaries are vertical lines located at $x = i \times \text{slideWidthPx}$ for $i \in \{1, \ldots, N - 1\}$.
- Guides are rendered on a dedicated non-interactive overlay `Layer` (`listening={false}`).
- Guide styling: translucent dashed line (`dash={[6, 6]}`) with subtle badge pills at top reading `Slide 1 | Slide 2`.
- Snap engine can snap frame edges to slide boundary lines.

### 3.3 Seamless Panorama
Because the Konva Stage is continuous:
A photo frame placed at $x = 800$, $\text{width} = 600$ in a 1080px wide slide spans from Slide 1 ($x \in [0, 1080)$) into Slide 2 ($x \in [1080, 2160)$).
No image cloning or complex masking is required during canvas editing!

---

## 4. UI Components & Integration Points

1. **`AppTitleBar.tsx`**:
   The `ModeSwitcher` pill already has `activeMode` and `onModeSelect` shells.
   Wiring this state in `WorkspaceLayout.tsx` switches the editor and navigation views.

2. **`StatusBar.tsx`**:
   When `activeMode === 'carousel'`:
   - Left: Displays `Slide X of N | 1080 × 1080 px (1:1)`
   - Center: Toggles `Snap: ON/OFF` and `Slice Guides: ON/OFF`
   - Right: Retains continuous zoom slider and Fit button (`⌘0`)

3. **`SlideNavigator.tsx`**:
   Renders at the bottom of the center area in place of `PageNavigator`.
   Features horizontal thumbnail cards for each slide, slide numbers, context menus (Duplicate, Delete, Move), and a button to launch the `PhoneSwipeSimulator`.

4. **`PhoneSwipeSimulator.tsx`**:
   An overlay modal with an iPhone frame mockup (390×844) using CSS scroll-snap to preview the carousel swipe feeling interactively.

---

## 5. Plan Breakdown

- **Plan 03-01**: Carousel Data Model, Mode Switcher & Zustand Store Extension
- **Plan 03-02**: Carousel Canvas Engine, Slide Navigator & Phone Swipe Simulator

---
*Status: Ready for Implementation.*
