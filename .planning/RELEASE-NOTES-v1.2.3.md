# Release Notes: OpenSmartAlbum v1.2.3

## 🌟 What's New in v1.2.3: Carousel Studio & Workspace Overhaul

This release delivers major UX upgrades and critical bug fixes for Social Carousel mode, keyboard shortcuts, photo reuse workflows, and the mobile preview simulator.

---

### 🚀 Key Improvements & Fixes

#### 1. 🖼️ Real Slide Previews in Carousel Strip
* Replaced empty white cards in the slide navigator with live miniature slide previews (`MiniSlidePreview`).
* Accurately renders miniature photos, background colors, and element layout geometry.
* Slide cards now dynamically match the carousel aspect ratio (`1:1`, `4:5`, `9:16`).

#### 2. 📐 Fixed Dynamic Layouts on Slide 2, 3, and Beyond
* Fixed horizontal world coordinate translation (`slideStartX + rect.x`) in generative layout actions (`applyDynamicSlideLayoutByIndex`, `cycleSlideLayout`, and `autoFlowPhotosToSlides`).
* Photos placed on subsequent slides now correctly remain on their respective slides instead of being displaced onto Slide 1.
* Resolves the *"No photos on active slide"* inspector error when navigating across slides.

#### 3. 🌄 Expanded Seamless Panoramas (4 → 9 Presets)
* Added 5 brand-new panorama layout presets:
  1. **4-Slide Cinematic Panorama:** 1 ultra-wide panoramic photo spanning 4 consecutive slides edge-to-edge.
  2. **2-Slide Panorama + Dual Cards:** Continuous background panorama with inset cards on both slides.
  3. **2-Slide Asymmetric Panorama:** Panorama across 1.5 slides with a side portrait photo on the right.
  4. **3-Slide Ultra + Dual Insets:** 3-slide panoramic background with focus detail cards on slides 1 & 3.
  5. **2-Slide Bottom Pano + Top Split:** Seamless bottom half panorama with 2 individual header photos.

#### 4. ⌨️ Complete Keyboard Shortcut Reliability
* Eliminated the React `useCallback` stale closure in `WorkspaceLayout`.
* `Cmd+Z` (Undo), `Cmd+Shift+Z` / `Cmd+Y` (Redo), and `Cmd+A` (Select All) now dynamically route to the active workspace mode (Print Album vs. Social Carousel) in real-time.
* Removed duplicate/conflicting window listeners between `WorkspaceLayout` and `CarouselCanvas`.

#### 5. 🎨 Vivid Used Photos & Canvas Drop-to-Replace
* Removed `grayscale(45%)` and `opacity: 0.65` from used photo cards in the filmstrip. Photos remain 100% full-color, sharp, and vibrant for easy multi-use across spreads and slides.
* Added dynamic usage counter badge: `Used`, `Used (2×)`, `Used (3×)`, etc.
* Added **Drop-to-Replace** in `CarouselCanvas`: dragging a photo over an existing photo frame instantly replaces the frame's content.

#### 6. 📱 Realistic iPhone 16 Pro Mobile Swipe Simulator
* Synchronized CSS modules and JSX classes in `PhoneSwipeSimulator`.
* Realistic iPhone frame (`360px × 680px`), Dynamic Island pill, backdrop blur, horizontal swipe snap, left/right navigation arrows, and page dots indicator. No more oversized or broken mobile previews.

---

### 📦 Checksums & Assets
* **macOS Universal / Apple Silicon Installer:** `OpenSmartAlbum_1.2.3_aarch64.dmg`
