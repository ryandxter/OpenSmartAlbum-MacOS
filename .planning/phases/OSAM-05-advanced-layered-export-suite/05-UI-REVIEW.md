# Visual & UX Audit: Advanced Layered Export Suite (OSAM-05)

**Target Component**: [`ExportAlbumDialog.tsx`](file:///Users/chiio/VSCode/albumaker/src/features/export/ExportAlbumDialog.tsx) & Related Components  
**Related Components**: [`ExportSpreadPreview.tsx`](file:///Users/chiio/VSCode/albumaker/src/features/export/ExportSpreadPreview.tsx), [`ExportProgressModal.tsx`](file:///Users/chiio/VSCode/albumaker/src/features/export/ExportProgressModal.tsx), [`exportUtils.ts`](file:///Users/chiio/VSCode/albumaker/src/features/export/exportUtils.ts)  
**Auditor**: `gsd-phase5-ui-auditor`  
**Date**: 2026-09-22  
**Audit Framework**: 6-Pillar Desktop Pro Creative Suite Audit  

---

## 1. Executive Summary & Audit Scorecard

The OSAM-05 Export Suite implementation delivers an advanced, studio-grade export experience that unifies 5 professional prepress archival formats (JPEG, PNG, TIFF, PDF/X, PSD) alongside multi-slide Instagram carousel exporting. The UI features a high-density 2-column layout, real-time proofing preview with interactive guide overlays, pre-flight disk verification, overwrite protection, and missing photo detection.

Overall, the suite demonstrates excellent engineering maturity, prepress precision, and visual cohesion. However, targeted refinements are recommended in design token strictness (eliminating chromatic blue fallbacks in favor of the neutral charcoal palette), ARIA accessibility for custom card selectors, and icon stroke consistency.

### Scorecard by Pillar

| Pillar | Rating | Status | Summary |
| :--- | :---: | :---: | :--- |
| **1. Design System & Token Alignment** | **8.5 / 10** | **Pass with Recommendations** | Strong adherence to dark charcoal theme; several hardcoded blue accents (`#38bdf8`, `rgb(59 130 246)`) deviate from zero-chromatic pro studio tokens. Minor icon stroke width omission. |
| **2. Desktop Ergonomics & Layout** | **9.5 / 10** | **Pass** | Exceptional 2-column studio layout (1040px fixed width, 90vh clamp). Sticky live preview, responsive breakpoints at 1040px and 900px, intuitive segmented controls. |
| **3. Standard Professional English** | **9.8 / 10** | **Pass** | Flawless InDesign and Lightroom prepress terminology. Zero broken English, zero casual slang. Accurate technical phrasing across TIFF, PDF/X, and PSD specifications. |
| **4. Feedback & Pre-flight Validation** | **9.8 / 10** | **Pass** | Best-in-class upfront pre-flight check (`preflight_check_export`), dedicated overwrite conflict modal with file list, and missing photos modal with relink action. Detailed progress modal with safe cancellation. |
| **5. Accessibility & Keyboard Navigability** | **8.0 / 10** | **Pass with Recommendations** | Full Escape key and modal overlay handling, focus rings, clear labels. However, format cards and folder cards are clickable `<div>`s lacking ARIA roles (`role="radio"` / `role="button"`), `tabIndex`, and keyboard triggers. |
| **6. Performance & Responsiveness** | **9.7 / 10** | **Pass** | Thorough `useMemo` isolation across spread projection, 2D topological element alignment, and range resolution. Instantaneous tab switching between Print Studio and Carousel Studio. |

**Overall Score**: **9.2 / 10 (High Quality Desktop Pro Suite)**

---

## 2. Pillar-by-Pillar Detailed Analysis

### Pillar 1: Design System & Token Alignment

#### Strengths
- **Native Apple SF Pro Stack**: Aligns with [`tokens.css`](file:///Users/chiio/VSCode/albumaker/src/styles/tokens.css) font definition (`-apple-system, BlinkMacSystemFont, "SF Pro Text", ...`) with tight typographic scale (10px–12px body/inputs, 11px uppercase section headers with `letter-spacing: 0.6px`).
- **Monospace Previews**: Output filename previews (`.outputTagValue`), disk paths (`.folderFullPath`), and slice pills (`.slicePill`) consistently apply monospace styling (`--font-family-mono` / `monospace`).
- **Standardized Iconography**: 98% of Lucide icons across [`ExportAlbumDialog.tsx`](file:///Users/chiio/VSCode/albumaker/src/features/export/ExportAlbumDialog.tsx), [`ExportSpreadPreview.tsx`](file:///Users/chiio/VSCode/albumaker/src/features/export/ExportSpreadPreview.tsx), and [`ExportProgressModal.tsx`](file:///Users/chiio/VSCode/albumaker/src/features/export/ExportProgressModal.tsx) adhere strictly to `strokeWidth={1.5}`:
  - `FileText`, `Sliders`, `Tag`, `FolderOpen`, `Folder`, `AlertTriangle`, `RectangleHorizontal`, `PanelLeft`, `PanelRight`, `ShieldCheck`, `Scissors`, `ChevronLeft`, `ChevronRight`, `Image`, `FileImage`, `FileArchive`, `Layers`, `Info`, `Sparkles`, `RotateCcw`, `X`, `Download`, `FileDown`, `CheckCircle2`, `Square`, `Camera`.

#### Inconsistencies & Findings
1. **Chromatic Cast & Hardcoded Blue Fallbacks**:
   - In [`tokens.css`](file:///Users/chiio/VSCode/albumaker/src/styles/tokens.css#L5-L32), the project established the **Canonical Pro Studio neutral charcoal palette** (`--color-primary: #e4e4e7`, `--color-accent: #e4e4e7`) specifically to ensure **zero chromatic cast** that could bias photographic evaluation.
   - In [`ExportAlbumDialog.module.css`](file:///Users/chiio/VSCode/albumaker/src/features/export/ExportAlbumDialog.module.css), multiple active and hover styles use hardcoded Tailwind Sky/Blue fallbacks (`#38bdf8`, `rgba(59, 130, 246, ...)`, `#60a5fa`) instead of semantic tokens:
     - Line 103, 448, 797, 1065, 1349: `var(--color-primary, #38bdf8)`
     - Line 269: `.formatCardActive` uses `background-color: rgba(59, 130, 246, 0.14) !important;`
     - Line 409: `.dpiBadge` uses `color: var(--color-primary, #38bdf8); background: rgba(56, 189, 248, 0.12);`
     - Line 648, 701: `.sharpenIntensityBtnActive`, `.scopeBtnActive` use `rgba(59, 130, 246, 0.15)` and text `#60a5fa`
     - Line 934: `.outputTagValue` uses `color: #38bdf8;`
   - In [`ExportAlbumDialog.tsx`](file:///Users/chiio/VSCode/albumaker/src/features/export/ExportAlbumDialog.tsx#L485): inline style `color: '#38bdf8'` for `full_panorama.jpg`.
2. **Missing `strokeWidth={1.5}` on Lucide Check Icon**:
   - In [`ExportAlbumDialog.tsx`](file:///Users/chiio/VSCode/albumaker/src/features/export/ExportAlbumDialog.tsx#L494): `<Check size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />` lacks `strokeWidth={1.5}` (renders at Lucide default 2.0).

---

### Pillar 2: Desktop Ergonomics & Layout

#### Strengths
- **Studio Layout Ratio**:
  - Modal dimensions are set to `width={1040}` with height clamped to `calc(90vh - 58px)`.
  - The left column (`580px` fixed width) keeps the live interactive spread preview sticky at the top (`position: sticky; top: 0;`), allowing photographers to visually inspect proofing while scrolling through format configurations on the right.
- **Visual Proofing Tools**:
  - `ExportSpreadPreview` provides instantaneous view mode switching:
    - **Full Spread (Facing)**: Shows the complete spread canvas with center spine guide.
    - **Left Page / Right Page**: Crops the view directly to the single trimmed page.
  - Interactive overlays include:
    - **Safe Area Margins** (dashed blue guide, 20% opacity border).
    - **Print Lab Trim Cut Line** (dashed red guide indicating finished cut).
    - **Split Slicing Cut Line** with scissors icon when single pages are exported.
- **Live Specs HUD**:
  - Displays millimeter physical dimensions (e.g. `406.0 × 305.0 mm`), live output pixels (e.g. `4795 × 3602 px @ 300 DPI`), active format, and element counts (`8 photos, 2 text`).
- **Responsive Adaptations**:
  - `@media (max-width: 1040px)` collapses the layout into a stacked single-column view.
  - `@media (max-width: 900px)` reflows the 5 format cards into a 3-column grid.

#### Inconsistencies & Findings
1. **Vertical Space Utilization on Small Laptop Screens (1366×768 / 1280×800)**:
   - On display viewports with vertical heights around 768px, `calc(90vh - 58px)` leaves approximately 630px total modal height. The 580px preview container takes up 330px height, which is well balanced; however, the right-side configuration column requires scrolling. The smooth, subtle custom scrollbar (`.scrollableContent::-webkit-scrollbar`) prevents visual clutter.

---

### Pillar 3: Standard Professional English & Terminology

#### Strengths
- **Prepress & Archival Accuracy**:
  - "Full Spreads (Facing)" vs "Single Pages (Split L/R)" (Standard InDesign pagination nomenclature).
  - "Trim to Page Boundary" vs "Include Bleed (+3 mm)" (Standard prepress cut boundary terms).
  - "Concentric MediaBox, BleedBox, and TrimBox" (Accurate ISO 15930 PDF/X-3 specification terminology).
  - "Vector Hairline Trim Marks (0.5pt), Center Fold Ticks, and Slug Metadata".
  - "Archival Prepress TIFF with 8/16-bit color and LZW compression".
  - "8-bit RGB (24 bpp)" vs "16-bit Deep Color (48 bpp Archival)".
  - "Output Print Sharpening: Unsharp masking tailored for photo paper" (`Lustre / Matte Paper` vs `Glossy / Fine Art`).
  - "Discrete photo frames on individual layers with non-destructive vector shape channel masks".
- **Linguistic Quality**:
  - Zero colloquialisms, zero broken sentences, and grammatically flawless UI strings throughout.

#### Inconsistencies & Findings
1. **Bleed Zero Indicator**:
   - In [`ExportAlbumDialog.tsx`](file:///Users/chiio/VSCode/albumaker/src/features/export/ExportAlbumDialog.tsx#L947): `Include Bleed (+{activeSpread?.bleed || 0} {currentProject.canvasUnit})`.
   - If an album or cover spread has bleed unset (or 0), this displays `Include Bleed (+0 mm)`. It is more professional to fall back to `currentProject.bleed` or show `Include Bleed (+3 mm standard)` when spread bleed is unspecified.
2. **Footer Summary Unit Clarity**:
   - In the footer summary bar, when `splitPages` is true, the button says `Export Album ({targetSpreadCount})` where `targetSpreadCount` is the number of spreads. When exporting single pages, photographers expect to see the total number of single page files (e.g. `Export 16 Pages` rather than `Export 8 Spreads`).

---

### Pillar 4: Feedback & Pre-flight Validation

#### Strengths
- **Upfront Pre-Flight Engine**:
  - Calls `invoke('preflight_check_export', { projectId, options })` before starting any export.
  - Validates folder write permissions before processing raster images.
- **Dedicated Overwrite Protection Modal**:
  - When target files already exist in the chosen directory, a specialized modal popup (`isOverwriteModalOpen`, width 500) opens.
  - Lists every conflicting filename in a scrollable list with a prominent `Will be overwritten` badge.
  - Provides two distinct, color-coded actions: "Cancel / Change Folder" (secondary) vs "Overwrite Existing Files" (danger red).
- **Dedicated Missing Photos Warning Modal**:
  - When original high-res photos are missing from disk, `isMissingModalOpen` (width 520) alerts the user that low-res thumbnails would be used.
  - Lists the spread name, filename, and full missing path for each missing asset.
  - Directly exposes "Locate & Relink Photos..." which immediately opens the photo relink tool, preventing accidental low-quality print jobs.
- **Comprehensive Progress Modal**:
  - [`ExportProgressModal.tsx`](file:///Users/chiio/VSCode/albumaker/src/features/export/ExportProgressModal.tsx) provides a smooth animated visualizer during export.
  - Displays dual progress metrics: spread progress (`X of Y Spreads`) and rasterization progress (`A of B Photos`).
  - Safe background cancellation via `invoke('cancel_export')` with dedicated "Export Was Cancelled" state.
  - On finish, displays all generated files with filetype badges (PDF Document, PNG, JPEG) and a 1-click "Open Export Folder" button.

---

### Pillar 5: Accessibility & Keyboard Navigability

#### Strengths
- **Modal Semantics**:
  - Handled via [`Dialog.tsx`](file:///Users/chiio/VSCode/albumaker/src/components/ui/Dialog.tsx) with `role="dialog"`, `aria-modal="true"`, and `aria-labelledby="dialog-title"`.
  - Closes gracefully on Escape keypress (`closeOnEscape={true}`).
  - Prevents background document scrolling (`document.body.style.overflow = 'hidden'`).
- **Focus Rings**:
  - Uses `:focus-visible` with `box-shadow: var(--focus-ring)`.
  - Radio buttons and checkboxes are wrapped in `<label>` elements.

#### Inconsistencies & Findings
1. **Non-Semantic Format Cards**:
   - In [`ExportAlbumDialog.tsx`](file:///Users/chiio/VSCode/albumaker/src/features/export/ExportAlbumDialog.tsx#L722-L781), the 5 format options (`High-Res JPEG`, `Lossless PNG`, `Lossless TIFF`, `Print PDF`, `Layered PSD`) are rendered as `<div className={styles.formatCard} onClick={...}>`.
   - These lack `role="radio"` (or `role="button"`), `tabIndex={0}`, `aria-checked={format === '...'}`, and `onKeyDown` listeners (Enter / Space). Keyboard-only users cannot tab into or toggle format options.
2. **Interactive Folder Card**:
   - Line 1320: `<div className={styles.modernFolderCard} onClick={handleSelectFolder}>` is a clickable container without keyboard activation. The internal "Browse..." button can be focused, but the parent card should have `role="button"` or delegate focus properly.
3. **Icon-Only Buttons Lacking ARIA Labels**:
   - Line 1273: `<button className={styles.inputClearBtn} onClick={...} title="Clear prefix">` has a `title` attribute but lacks `aria-label="Clear prefix"`.
4. **Dynamic Validation Announcements**:
   - `.errorBanner` and `.customScopeResult` lack `aria-live="polite"` or `role="alert"`, meaning screen readers will not announce dynamic range validation updates or error states.

---

### Pillar 6: Performance & Responsiveness

#### Strengths
- **Extensive Memoization**:
  - `allSpreads`, `previewSpread`, `currentSpreadIdx`, and `targetSpreads` are strictly memoized in `ExportAlbumDialog.tsx`.
  - In `ExportSpreadPreview.tsx`, `calculatePreviewProjection`, `safeArea`, and `alignPreviewElementBounds` (which executes the 2D topological element alignment graph) are wrapped in `useMemo`, preventing expensive recalculations during minor parent re-renders.
- **Asset Protocol Optimization**:
  - `safeConvertFileSrc` queries local cached preview/thumbnail paths rather than loading uncompressed 50MB RAW files into the live preview DOM.
- **Zero-Flicker Tab Switching**:
  - Switching between "Print Album Studio" and "Instagram Carousel Slices" is instantaneous, keeping state intact without mounting/unmounting the entire dialog shell.

---

## 3. Comprehensive Findings Matrix

| ID | Pillar | Severity | Component / Location | Issue Description | Recommended Remediation |
| :--- | :--- | :---: | :--- | :--- | :--- |
| **A-01** | Token Alignment | **Medium** | `ExportAlbumDialog.module.css` (lines 103, 269, 409, 448, 648, 701, 797, 934, 1065, 1349) | Chromatic blue colors (`#38bdf8`, `rgba(59, 130, 246, ...)`, `#60a5fa`) used instead of neutral studio tokens. | Replace hardcoded blues with `--color-accent` (`#e4e4e7`), `--color-surface-active`, and `--color-primary`. |
| **A-02** | Accessibility | **Medium** | `ExportAlbumDialog.tsx` (lines 722–781) | Format cards are `<div>` elements with `onClick`, lacking `role="radio"`, `aria-checked`, `tabIndex={0}`, and `onKeyDown`. | Convert to semantic radio buttons or add `role="radio"`, `tabIndex={0}`, and Enter/Space keyboard handlers. |
| **A-03** | Token Alignment | **Low** | `ExportAlbumDialog.tsx` (line 494) | Lucide `<Check size={14} ... />` missing `strokeWidth={1.5}`. | Add `strokeWidth={1.5}` to match project icon standard. |
| **A-04** | Accessibility | **Low** | `ExportAlbumDialog.tsx` (line 1273) | Clear prefix button has `title` but missing `aria-label="Clear prefix"`. | Add `aria-label="Clear prefix"` to the button element. |
| **A-05** | Accessibility | **Low** | `ExportAlbumDialog.module.css` / `tsx` (lines 597, 1209, 1358) | Error banners and custom scope feedback lack `aria-live="polite"`. | Add `role="status"` or `aria-live="polite"` to validation feedback containers. |
| **A-06** | Professional Copy | **Low** | `ExportAlbumDialog.tsx` (line 947) | When bleed is 0 or undefined, label displays `Include Bleed (+0 mm)`. | Display project bleed default (`currentProject.bleed || 3`) when active spread bleed is undefined or 0. |
| **A-07** | Ergonomics | **Low** | `ExportAlbumDialog.tsx` (line 1442) | Main CTA button text says `Export Album ({targetSpreadCount})` regardless of split pages mode. | Dynamically display `Export {targetPageCount} Pages` when `splitPages` is enabled. |

---

## 4. Code Remediation Examples

### Remediation for A-01: Neutral Charcoal Palette Token Alignment
In `ExportAlbumDialog.module.css`:
```css
/* BEFORE */
.formatCardActive {
  background-color: rgba(59, 130, 246, 0.14) !important;
  border-color: var(--color-primary) !important;
  box-shadow: 0 0 0 1px var(--color-primary);
}

.viewPillActive {
  background: var(--color-primary, #38bdf8) !important;
  color: #090d16 !important;
}

/* AFTER (Clean Neutral Pro Studio Alignment) */
.formatCardActive {
  background-color: rgba(255, 255, 255, 0.08) !important;
  border-color: var(--color-accent, #e4e4e7) !important;
  box-shadow: 0 0 0 1px var(--color-accent, #e4e4e7);
}

.viewPillActive {
  background: var(--color-accent, #e4e4e7) !important;
  color: var(--color-text-inverse, #18181b) !important;
}
```

### Remediation for A-02: Keyboard-Navigable Format Cards
In `ExportAlbumDialog.tsx`:
```tsx
{/* Format Card with Full Keyboard Accessibility */}
<div
  role="radio"
  aria-checked={format === 'tiff'}
  tabIndex={0}
  className={`${styles.formatCard} ${format === 'tiff' ? styles.formatCardActive : ''}`}
  onClick={() => {
    setFormat('tiff');
    setPreflightReport(null);
  }}
  onKeyDown={(e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      setFormat('tiff');
      setPreflightReport(null);
    }
  }}
  title="Archival Prepress TIFF with 8/16-bit color and LZW compression"
>
  <span className={styles.formatIcon}><FileArchive size={20} strokeWidth={1.5} /></span>
  <span className={styles.formatName}>Lossless TIFF</span>
  <span className={styles.formatDesc}>Archival Prepress</span>
</div>
```

---

## 5. Conclusion & Verification Sign-Off

The OSAM-05 Advanced Layered Export Suite represents a high-caliber prepress and publishing interface that meets commercial prepress production expectations. Its visual proofing stage with accurate millimeter geometry and live guidelines, combined with upfront pre-flight verification, ensures that photographers and book designers can export with confidence.

Applying the recommendations outlined in the Findings Matrix will elevate the suite to 10/10 compliance across accessibility and design system purity.

**Audit Status**: **APPROVED WITH MINOR ENHANCEMENTS**  
**Ready for Phase 5 Wrap-Up & User Verification**.
