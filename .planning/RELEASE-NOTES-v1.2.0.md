## 🎨 v1.2.0 — Unlimited Studio Layout & Storytelling Engine

OpenSmartAlbum now delivers **professional-grade generative layouting** ala Pixellu SmartAlbums and Fundy Designer — unlimited, non-destructive, and zero photo loss.

---

### ✨ What's New

#### 🧮 Dynamic Generative Layout Engine (Phase 10)
- **R-BSP Slicing Tree** generates mathematically-balanced, editorial-quality slot partitions for 1–15 photos per spread/slide
- **Kuhn-Munkres (Hungarian) O(N³) aspect matching** — optimal photo-to-slot assignment based on aspect ratio energy minimization
- **Zero blank frames, zero photo dropping** — guaranteed invariant across all layout cycling
- **`Spacebar` / `Shift+Space` studio cycling** — instantly cycle through unlimited layout variations with sub-16ms response
- Equal-height row normalizer + equal-width column normalizer with 0px hairline seam guarantee

#### 📖 Auto-Flow Multi-Spread Storytelling Engine (Phase 11)
- **EXIF temporal clustering** — groups photos into narrative scenes by timestamp proximity
- **Auto-Flow (N) button** — one-click to distribute selected photos across multiple sequential spreads or slides with cadence pacing
- Atomic single-step undo for the entire auto-flow operation
- Supports both Print Album and Social Carousel modes

#### 🖱️ Contextual Right-Click Studio Actions (Phase 12)
- **Right-click → Set as Full Bleed Spread** — photo expands to cover entire spread + bleed, remaining photos reflow to new interior spread
- **Right-click → Set as Seamless Panorama Span (2/3 Slides)** — spans a carousel photo across 2 or 3 slides with virtual cut guides
- **Right-click → Set as Hero / Anchor Photo** — biases Kuhn-Munkres assignment so hero occupies the largest slot
- **Spine Clearance Warning** — amber corridor overlay when photo focal center falls within the binding gutter zone (±19mm)

#### 🔲 Interactive In-Canvas Divider Dragging (Phase 13)
- **60fps RAF-coalesced divider dragging** — drag shared edges between adjacent frames to resize them live, zero React re-renders during drag
- **Axis-locked, clamped dividers** — vertical dividers move only horizontally; minimum frame size enforced
- **Direct photo drag-swap** — drag any photo onto another to swap their content; cyan `#38BDF8` glow ring highlights the target
- Available in both Print Album and Social Carousel canvases

---

### 🐛 Bug Fixes
- Fixed `isSpacePanning` undefined reference in `KonvaEditorCanvas`
- Fixed layout cycling dropping photos when active slide has panorama presets
- Fixed carousel ratio switch distorting existing frame proportions
- Fixed vector shape clipping masks rendering incorrectly for Star, Heart, Scallop shapes

---

### 📦 Installation

Download `OpenSmartAlbum_1.2.0_universal.dmg` from the assets below.

> **macOS** — Apple Silicon + Intel Universal Binary. Requires macOS 12.0+.
> On first launch: right-click → Open to bypass Gatekeeper (app is not yet notarized).

---

### 🧪 Test Coverage

| Suite | Assertions | Result |
|-------|-----------|--------|
| Generative Layout Engine | 5 suites | ✅ 100% |
| Divider Graph + Integration | 10 suites | ✅ 100% |
| Hero Biasing + Full Bleed | 4 suites | ✅ 100% |
| Carousel Panorama Span | 6 suites | ✅ 100% |
| TypeScript (`tsc --noEmit`) | 0 errors | ✅ |
| Production build | clean | ✅ |
