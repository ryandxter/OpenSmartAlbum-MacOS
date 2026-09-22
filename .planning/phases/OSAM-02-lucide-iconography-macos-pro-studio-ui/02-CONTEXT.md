# Phase 2: Lucide Iconography & macOS Pro Studio UI — Context

## Implementation Decisions

### 1. Lucide Icon Migration Architecture
- **Import Strategy**: Direct tree-shakeable imports from `lucide-react` (e.g. `import { ZoomIn, LayoutGrid, Image } from 'lucide-react'`).
- **Icon Sizing & Stroke Tokens**:
  - Stroke weight: **1.5px** default across all toolbars, inspectors, and status bars for a clean Apple Pro Studio aesthetic.
  - Sizing tokens:
    - Micro: `14px` (sub-labels, badge icons)
    - Compact: `16px` (table rows, inspector property inputs)
    - Standard: `18px` / `20px` (toolbar buttons, panel headers)
    - Featured: `24px` (modal headers, empty state graphics)
- **Dynamic Styling**: Icons inherit `currentColor` and react smoothly to hover/active/disabled states.

### 2. macOS Studio Window & Titlebar Integration
- Integrated macOS native window titlebar:
  - Custom drag region (`data-tauri-drag-region`) across the titlebar.
  - Left padding (`pl-20`) to accommodate native macOS window traffic lights (close, minimize, zoom) without overlap.
  - Centered project title with unsaved changes indicator (`•`).
  - Right-aligned Mode Switcher (Print Album ↔ Instagram Carousel) and primary action buttons (Export, Settings).

### 3. Inspector Panel Ergonomics
- Modular accordion system with **Multi-Expandable sections** (users can keep Spacing, Shapes, and Effects open simultaneously).
- Smooth CSS transitions with chevron indicator icons.
- Sections:
  1. `Layout & Spacing` (Dimensions, Gap slider, 2D Neighbor Graph multi-resize indicators)
  2. `Shapes & Borders` (Preset shape picker, corner radii, stroke styles, colors)
  3. `Typography` (Font family, size, line-height, letter-spacing, text alignment)
  4. `Effects & Shadows` (Drop shadow, opacity, blur)

### 4. Color Palette & Theming
- **Base Background**: Figma/Lightroom Deep Charcoal (`#18181B` / `#1E1E20`) with subtle contrast borders (`#2E2E33`).
- **Selection & Accent**: **Neutral Monochrome / Graphite** accent tones. This avoids color distraction or visual tint bias when photographers review and color-grade album photos on the canvas.
- **Typography Stack**: Apple system font stack (`-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display"`).
- **Shortcut Bindings**: Replace `Ctrl` with `⌘` (`Meta`) across all shortcut tooltips, HUD labels, and event listeners.

---
*Created: 2026-09-22 via /gsd-discuss-phase*
