# Phase 12 Research: Contextual Right-Click Studio Actions & Panorama Span Engine

**Milestone:** v1.2.0: Unlimited Studio Layout & Storytelling Engine  
**Phase:** 12 - Contextual Right-Click Studio Actions & Panorama Span Engine  
**Author:** gsd-phase-researcher  
**Date:** 2026-09-23  
**Status:** COMPLETE  

---

## Executive Summary

Phase 12 delivers professional contextual studio ergonomics ala **Fundy Designer** and **Pixellu SmartAlbums**, empowering users to manipulate layouts directly from the canvas via right-click contextual menus:
1. **Set as Full Bleed Spread (2-Page Panorama)** in Print Album mode (spanning trim edges and bleed with zero photo loss).
2. **Set as Seamless Panorama Span** in Social Carousel mode (continuous canvas spanning across 2 or 3 slides with virtual cut guides and seamless swipe simulation).
3. **Set as Hero / Anchor Photo** in both modes (leveraging the Kuhn-Munkres Hungarian bipartite assignment algorithm to prioritize the chosen photo in dominant slots).
4. **Spine Clearance Protection** in Print Album mode (visualizing the physical book binding crease zone at $X_{\text{spine}} \pm 19\text{mm}$ to prevent subject loss in the physical gutter).

This document details the architectural interfaces, geometric formulas, data structure lifecycles, and failure-prevention invariants needed to implement Phase 12 with zero regressions.

---

## 1. Architectural Investigation by Domain

### 1.1 Context Menu Architecture (`KonvaEditorCanvas.tsx` & `CarouselCanvas.tsx`)

#### Existing State in `KonvaEditorCanvas.tsx`:
- `KonvaEditorCanvas.tsx` already imports and renders `<ContextMenu>` from [src/components/ui/ContextMenu.tsx](file:///Users/chiio/VSCode/albumaker/src/components/ui/ContextMenu.tsx).
- Right-click events on `PhotoFrameNode` are captured via Konva's `onContextMenu` handler:
  ```typescript
  // PhotoFrameNode in KonvaEditorCanvas.tsx
  onContextMenu={(e) => {
    e.evt.preventDefault();
    e.cancelBubble = true;
    if (!isCropMode) {
      if (!isSelected) {
        onSelect();
      }
      onContextMenu?.(e);
    }
  }}
  ```
- Position tracking: `contextMenuPhysicalPosRef.current = { x: physX, y: physY }` captures the physical millimeter/inch coordinates under the mouse pointer.
- `getContextMenuItems()` currently outputs: Delete, Copy, Paste, Paste in Place, Paste to All Spreads, Duplicate, Group/Ungroup, Lock/Unlock, Swap 2 Photos, Alignment submenus, Match Size submenus, Spacing & Distribution, Arrange & Transform (Bring to Front, Send to Back, Rotate, Reset Aspect, Reset Crop).
- **Required Phase 12 Additions to `getContextMenuItems()`**:
  When `photoCount === 1` and selection is a photo:
  1. `Set as Full Bleed Spread (2-Page Panorama)` (available on 2-page interior spreads).
  2. `Set as Hero / Anchor Photo` (available when current spread contains $\ge 2$ photos).

#### Missing State in `CarouselCanvas.tsx`:
- `CarouselCanvas.tsx` currently has **no context menu component or right-click handlers**.
- Right-clicking on a carousel photo currently triggers the default browser/WebKit context menu.
- **Required Phase 12 Additions to `CarouselCanvas.tsx`**:
  1. Add `contextMenu` state:
     ```typescript
     const [contextMenu, setContextMenu] = useState<{
       isOpen: boolean;
       x: number;
       y: number;
       frameId?: string | null;
     }>({ isOpen: false, x: 0, y: 0, frameId: null });
     ```
  2. Add `onContextMenu` to `CarouselFrameNode` and `Stage`:
     ```typescript
     // CarouselFrameNode
     onContextMenu={(e) => {
       e.evt.preventDefault();
       e.cancelBubble = true;
       setSelectedFrameId(frame.id);
       setContextMenu({
         isOpen: true,
         x: e.evt.clientX,
         y: e.evt.clientY,
         frameId: frame.id,
       });
     }}
     ```
  3. Implement `getCarouselContextMenuItems()`:
     - `Set as Seamless Panorama Span (2 Slides)` (icon: `Columns` or `Maximize2`)
     - `Set as Seamless Panorama Span (3 Slides)` (icon: `Columns` or `Maximize2`)
     - `Set as Hero / Anchor Photo` (icon: `Star`)
     - `↺ Reset Crop & Center`
     - `Duplicate Photo`
     - `Bring to Front` / `Send to Back`
     - `Delete Photo Frame` (danger)
  4. Render `<ContextMenu>` portal at the root of `CarouselCanvas.tsx`.

---

### 1.2 Promoting to Full Bleed Spread in Print Album Mode

#### Preconditions & Physical Geometry Math
When a user right-clicks photo $P$ on Spread $S$ and selects `Set as Full Bleed Spread (2-Page Panorama)`:
1. Spread Dimensions & Bleed:
   ```typescript
   const dims = getProjectDimensionsInCanvasUnit(project, spread);
   const spreadWidth = dims.pageWidth * 2 + dims.gutterWidth;
   const spreadHeight = dims.pageHeight;
   const bleed = dims.bleed;
   ```
2. Exact Physical Full-Bleed Coordinates:
   $$\begin{aligned}
   x &= -\text{bleed} \\
   y &= -\text{bleed} \\
   \text{width} &= \text{spreadWidth} + 2 \cdot \text{bleed} \\
   \text{height} &= \text{spreadHeight} + 2 \cdot \text{bleed}
   \end{aligned}$$
   *(Note: This guarantees the physical photo extends outwards by $+3\text{mm} / 0.125\text{in}$ beyond all 4 guillotine trim lines, eliminating paper edge slivers).*
3. Crop & Pan Invariance:
   - Reset frame rotation to `0`.
   - Center crop: `cropX = 0`, `cropY = 0`, `cropScale = 1.0` (or preserve user's pan anchor normalized to the new aspect ratio).

#### Non-Destructive Zero-Loss Photo Invariant & Reflow Mechanics
Let $N$ be the number of photos on Spread $S$.
- **Case $N = 1$:** Photo $P$ is resized to the full-bleed spread bounds. Done.
- **Case $N > 1$:**
  Target photo $P$ becomes the exclusive full-bleed photo on Spread $S$.
  To guarantee **Zero-Loss**:
  1. Extract remaining $(N - 1)$ photos:
     ```typescript
     const remainingPhotos = spread.elements
       .filter((el): el is PhotoFrameElement => el.type === 'photo' && el.id !== targetFrameId);
     ```
  2. Create a new interior spread immediately following Spread $S$:
     ```typescript
     const newSpreadNumber = activeSpreadIndex + 2;
     const newSpread = createInteriorSpread(currentAlbum, project, newSpreadNumber);
     ```
  3. Convert remaining photos into `AdaptivePhoto[]` models:
     ```typescript
     const reflowPhotos: AdaptivePhoto[] = remainingPhotos.map(el => ({
       id: el.id,
       photoId: el.photoId,
       filePath: el.filePath,
       fileName: el.fileName,
       previewPath: el.previewPath,
       thumbnailPath: el.thumbnailPath,
       photoAspect: el.photoAspect,
     }));
     ```
  4. Synthesize optimal generative layout for the $(N - 1)$ photos using `generateDynamicVariations`:
     ```typescript
     const variations = generateDynamicVariations({
       containerWidth: spreadWidth,
       containerHeight: spreadHeight,
       isSpread: true,
       isCover: false,
       spacing: dims.spacing,
       gutterWidth: dims.gutterWidth,
       safeMarginTop: dims.safeMarginTop,
       safeMarginBottom: dims.safeMarginBottom,
       safeMarginOutside: dims.safeMarginOutside,
       safeMarginSpine: dims.safeMarginSpine,
     }, reflowPhotos);
     ```
  5. Populate `newSpread.elements` using `buildSpreadElementsFromVariation(variations[0], reflowPhotos, ...)`.
  6. Insert `newSpread` into `album.spreads` at index `activeSpreadIndex + 1`.
  7. Recalculate page numbers: `recalculateAlbumPageNumbers({ ...currentAlbum, spreads: updatedSpreads })`.
  8. Atomic Transaction:
     Wrap the entire operation in a single `useHistoryStore.getState().pushState(beforeAlbum)` call. When the user presses `⌘Z`, both the full-bleed promotion and the newly inserted spread revert in **one single undo step**.

---

### 1.3 Seamless Panorama Span in Social Carousel Mode

#### The Coordinate Architecture of `CarouselPhotoFrame`
In [src/domain/carousel.ts](file:///Users/chiio/Users/chiio/VSCode/albumaker/src/domain/carousel.ts#L57-L61):
```typescript
// Canvas coordinate system (x=0 begins at slide 0; can span across slide boundaries)
x: number;
y: number;
width: number;
height: number;
```
The carousel canvas is modeled as a continuous horizontal ribbon:
- Slide 0 starts at $X = 0$.
- Slide 1 starts at $X = \text{slideWidthPx}$.
- Slide $K$ starts at $X = K \cdot \text{slideWidthPx}$.

#### Representation Comparison: Single Spanning Frame vs. Sliced Clones
Two architectural approaches were evaluated:

| Criterion | Option A: Sliced Clones per Slide | Option B: Single Spanning Frame in Canvas Ribbon (Recommended) |
|---|---|---|
| **Data Representation** | Creates 2 or 3 separate `CarouselPhotoFrame` entities, each belonging to `slide[K].elements` with precomputed `cropX` offsets. | Creates 1 `CarouselPhotoFrame` placed on `slide[K].elements` with `width = slideWidthPx * spanSlides`. |
| **User Canvas Manipulation** | **Nightmare.** Moving or resizing the frame on Slide 0 requires bidirectional synchronization to update the crop and scale on Slide 1. | **Flawless.** The user interacts with 1 unified Konva node. The photo seamlessly stretches across the slide divider line. |
| **Seam Gaps & Hairline Cracks** | High risk of 0.5px sub-pixel rounding mismatches between the two independent slice masks. | Zero seam gaps. The texture is a single unbroken WebGL/2D draw call across the boundary. |
| **Preset Compatibility** | Incompatible with existing `CAROUSEL_LAYOUT_PRESETS` (`panorama_2_slide` and `panorama_3_slide`). | 100% compatible. `CAROUSEL_LAYOUT_PRESETS` already defines: `createFrame(photos[0], slideStartX, 0, slideWidth * 2, slideHeight)`. |

**Verdict:** Use **Option B (Single Spanning Frame in Continuous Canvas Space)**.

#### The "Hidden Flaw" in Phone Swipe Simulator & Production Export:
In `CarouselCanvas.tsx`, Layer 2 flattens all frames:
```typescript
const allFrames = currentCarousel.slides.flatMap(s => s.elements.filter(el => el.type === 'photo'));
```
Konva renders Layer 2 across the whole canvas, so the spanning frame displays seamlessly across slides in the editor!

**HOWEVER, in `PhoneSwipeSimulator.tsx` (and in slide export):**
```tsx
// Current code in PhoneSwipeSimulator.tsx lines 115-117:
{slide.elements
  .filter((el) => el.type === 'photo')
  .map((photoFrame) => { ... })}
```
Because the spanning frame is stored in `slide[K].elements`, `slide[K+1].elements` has no reference to it!
- On Slide $K$, the simulator clips the image to 100% width because `.slideSurface { overflow: hidden }`.
- On Slide $K+1$, the slide renders completely **blank**!

#### Architectural Solution for Swipe Simulator & Export:
Instead of querying only `slide.elements`, query all carousel frames whose continuous bounding box **intersects** the slide's domain:
```typescript
export function getSlideIntersectingFrames(
  allFrames: CarouselPhotoFrame[],
  slideIndex: number,
  slideWidth: number
): { frame: CarouselPhotoFrame; localX: number }[] {
  const slideStart = slideIndex * slideWidth;
  const slideEnd = slideStart + slideWidth;

  return allFrames
    .filter((f) => f.x < slideEnd && f.x + f.width > slideStart)
    .map((frame) => ({
      frame,
      localX: frame.x - slideStart,
    }));
}
```
In `PhoneSwipeSimulator.tsx`:
```tsx
const slideFrames = getSlideIntersectingFrames(allFrames, idx, slideW);

{slideFrames.map(({ frame: photoFrame, localX }) => {
  const leftPct = (localX / slideW) * 100;
  const widthPct = (photoFrame.width / slideW) * 100;
  return (
    <div
      key={`${photoFrame.id}-slice-${idx}`}
      style={{
        position: 'absolute',
        left: `${leftPct}%`,
        top: `${(photoFrame.y / slideH) * 100}%`,
        width: `${widthPct}%`,
        height: `${(photoFrame.height / slideH) * 100}%`,
        overflow: 'hidden',
      }}
    >
      <img src={src} ... />
    </div>
  );
})}
```
Because `.slideSurface` has `overflow: hidden`, Slide $K$ renders the left half $[0 \dots W]$, and Slide $K+1$ renders the right half $[W \dots 2W]$ with **100% continuous seam alignment** during swipe animations!

---

### 1.4 Setting Hero / Anchor Photo (Generative Layout Rebalancing)

#### Mathematical Hungarian Assignment Integration
In [src/domain/layout/aspectMatcher.ts](file:///Users/chiio/VSCode/albumaker/src/domain/layout/aspectMatcher.ts#L21-L53):
The assignment cost function between photo $i$ and slot $j$ is:
$$C_{ij} = C_{\text{aspect}}(i, j) + C_{\text{orient}}(i, j) + C_{\text{hero}}(i, j)$$

Currently:
```typescript
let heroBonus = 0;
const isHero = (photo.rating !== undefined && photo.rating >= 4) || Boolean(photo.isFavorite);
if (isHero && maxSlotArea > 0) {
  const slotArea = slot.width * slot.height;
  const areaRatio = slotArea / maxSlotArea;
  heroBonus = (1.0 - areaRatio) * 1.5;
}
```
An area penalty multiplier of `1.5` is too weak: if an orientation mismatch or aspect discrepancy exists, the Hungarian solver may still place the hero photo into a smaller slot to minimize global cost.

#### Hero Priority Formulation
To guarantee the hero photo is assigned to Slot 0 (the slot with maximum area $\ge 50\%$ spread area):
1. Extend `PhotoAspectInput` and `AdaptivePhoto`:
   ```typescript
   export interface PhotoAspectInput {
     aspect: number;
     rating?: number;
     isFavorite?: boolean;
     isHero?: boolean; // Phase 12 Explicit Hero Anchor
   }
   ```
2. Update `calculateSlotCost` with an explicit hero penalty factor:
   ```typescript
   if (photo.isHero && maxSlotArea > 0) {
     const slotArea = slot.width * slot.height;
     const areaRatio = slotArea / maxSlotArea; // 1.0 for largest slot
     // Heavy penalty against placing explicit hero in non-dominant slots
     heroBonus = (1.0 - areaRatio) * 20.0;
   }
   ```
3. Update `LayoutGeneratorOptions`:
   ```typescript
   export interface LayoutGeneratorOptions {
     ...
     heroPhotoId?: string; // Target photo promoted to Hero
   }
   ```
   When `generateDynamicVariations` is called, map `photos`:
   ```typescript
   const photoInputs: PhotoAspectInput[] = photos.map(p => ({
     aspect: p.photoAspect && p.photoAspect > 0 ? p.photoAspect : 1.5,
     rating: p.rating,
     isFavorite: p.isFavorite,
     isHero: Boolean((options.heroPhotoId && (p.id === options.heroPhotoId || p.photoId === options.heroPhotoId)) || p.isFavorite),
   }));
   ```
4. Prioritize Hero Archetypes in `generator.ts`:
   Candidates with `hero` archetype tags (e.g. `hero-companion-grid`, `Hero + Companion Stack`, Golden BSP cuts $0.618$) receive a score bonus, placing them at the top of the variation carousel.
5. In `albumStore.ts` & `carouselStore.ts`:
   Calling `setHeroPhoto(targetPhotoId)`:
   - Passes `heroPhotoId: targetPhotoId` to `generateDynamicVariations`.
   - Replaces the spread's active elements with Variation 0.
   - Pushes 1 state to `useHistoryStore` for single-step undo.

---

### 1.5 Spine Clearance Protection (Print Album Mode)

#### Physical Photobook Lab Standard
In layflat and hardcover flush-mount photobooks, spreads are folded and glued at the center spine crease:
- Center spine fold coordinate:
  $$X_{\text{spine}} = \text{pageWidth} + \frac{\text{gutterWidth}}{2} \quad (\approx \text{pageWidth} \text{ when gutter is } 0)$$
- Print lab binding exclusion corridor:
  $$X_{\text{spine}} \pm 19\text{mm} \quad (\approx \pm 0.75\text{ in})$$
Critical subjects (e.g. bride/groom faces, wedding vows, key focal points) placed inside this $38\text{mm}$ strip are prone to being obscured or creased by physical book binding.

#### Collision Detection Math
For any photo frame $F$:
1. Check if the frame spans across the center spine:
   $$\text{spansSpine} = (F.x < X_{\text{spine}} - 1) \land (F.x + F.w > X_{\text{spine}} + 1)$$
2. Compute the focal center $X_{\text{focal}}$:
   $$\Delta_{\text{cropX}} = F.\text{cropX} \quad (\text{if panned})$$
   $$X_{\text{focal}} = F.x + \frac{F.w}{2} + \Delta_{\text{cropX}}$$
3. Check exclusion violation:
   $$\text{spineCorridorViolation} = \text{spansSpine} \land \left( |X_{\text{focal}} - X_{\text{spine}}| \le \text{convertUnit}(19, \text{'mm'}, \text{unit}, \text{dpi}) \right)$$

#### Non-Printing Canvas Rendering
When a violation occurs:
1. In `KonvaEditorCanvas.tsx` Layer 3 (Overlay Guides):
   Render a non-printing amber spine corridor:
   ```tsx
   {/* Amber Spine Exclusion Corridor */}
   {hasSpineCorridorViolation && (
     <Group listening={false}>
       <Rect
         x={(X_spine - exclusionMm) * scaleFactor}
         y={0}
         width={(exclusionMm * 2) * scaleFactor}
         height={screenSpreadH}
         fill="rgba(245, 158, 11, 0.08)"
       />
       <Line
         points={[
           (X_spine - exclusionMm) * scaleFactor, 0,
           (X_spine - exclusionMm) * scaleFactor, screenSpreadH,
         ]}
         stroke="#F59E0B"
         strokeWidth={1}
         dash={[6, 4]}
         opacity={0.7}
       />
       <Line
         points={[
           (X_spine + exclusionMm) * scaleFactor, 0,
           (X_spine + exclusionMm) * scaleFactor, screenSpreadH,
         ]}
         stroke="#F59E0B"
         strokeWidth={1}
         dash={[6, 4]}
         opacity={0.7}
       />
       {/* Non-printing Warning Badge at top of spine */}
       <Group x={X_spine * scaleFactor} y={16}>
         <Label offsetX={110} offsetY={0}>
           <Tag
             fill="#78350F"
             stroke="#F59E0B"
             strokeWidth={1}
             cornerRadius={4}
             shadowColor="rgba(0,0,0,0.4)"
             shadowBlur={4}
           />
           <KonvaText
             text="⚠️ Subject in Spine Binding Zone (19mm)"
             fontSize={10}
             fontStyle="bold"
             fill="#FEF3C7"
             padding={4}
             fontFamily="sans-serif"
           />
         </Label>
       </Group>
     </Group>
   )}
   ```
2. Export Invariant:
   Because this guide is rendered in the interactive Konva canvas layer and not in the underlying spread model, it **never prints** or appears in high-resolution PDF/TIFF/PSD lab exports.

---

## 2. Interface Definitions

### 2.1 Domain & Store Types

```typescript
// --- src/domain/layout/generator.ts ---
export interface LayoutGeneratorOptions {
  containerWidth: number;
  containerHeight: number;
  spacing: number;
  isSpread: boolean;
  isCover?: boolean;
  gutterWidth?: number;
  safeMarginTop?: number;
  safeMarginBottom?: number;
  safeMarginOutside?: number;
  safeMarginSpine?: number;
  lockedElements?: PhotoFrameElement[];
  heroPhotoId?: string; // New in Phase 12
}

// --- src/domain/layout/aspectMatcher.ts ---
export interface PhotoAspectInput {
  aspect: number;
  rating?: number;
  isFavorite?: boolean;
  isHero?: boolean; // New in Phase 12
}

// --- src/stores/albumStore.ts ---
export interface AlbumState {
  ...
  promoteToFullBleedSpread: (spreadId: string, frameId: string) => void;
  setHeroPhotoOnSpread: (spreadId: string, frameId: string) => void;
}

// --- src/stores/carouselStore.ts ---
export interface CarouselState {
  ...
  setPanoramaSpan: (slideIndex: number, frameId: string, spanSlides: 2 | 3) => void;
  setHeroPhotoOnSlide: (slideIndex: number, frameId: string) => void;
}
```

---

## 3. Invariants & Defensive Strategies

| Invariant | Failure Mode | Defensive Strategy |
|---|---|---|
| **Zero-Loss Photo Invariant** | Promoting 1 photo to full bleed deletes other photos on the spread. | Extract all $(N-1)$ non-hero photos, dynamically synthesize a layout on a newly inserted adjacent spread, and insert it atomically. |
| **Zero-Blank Frame Guarantee** | Preset or generator creates frames with empty `filePath: ''`. | Every generated frame must match a real `photoId` and `filePath` from the spread pool; unassigned slots are rejected. |
| **Single Undo Step** | Reflowing photos creates 2-3 separate history entries; `⌘Z` undos only the new spread, leaving the prior spread broken. | Call `useHistoryStore.getState().pushState(beforeAlbum)` once at the transaction entrypoint before mutating state. |
| **Retina / Export Seam Alignment** | Slicing multi-slide panoramas creates 0.5px white hairline cracks during swipe animations. | Store continuous canvas coordinate $X$; project intersecting slices dynamically using `.slideSurface { overflow: hidden }`. |
| **Non-Printing Spine Overlay** | Amber spine warning lines print out on 300 DPI lab exports. | Spine warnings reside strictly in the interactive canvas guide layer and are excluded from Tauri/Rust rasterization. |

---

## 4. Implementation Phasing Recommendations for Planner

Phase 12 should be structured into **3 logical plans**:

1. **Plan 12-01: Contextual Menu Engine & Hero Anchor Matching**
   - Wire `onContextMenu` in `KonvaEditorCanvas.tsx` and build full `ContextMenu` support in `CarouselCanvas.tsx`.
   - Update `aspectMatcher.ts` and `generator.ts` with `isHero` / `heroPhotoId` dominant area weighting.
   - Implement `setHeroPhotoOnSpread` in `albumStore.ts` and `setHeroPhotoOnSlide` in `carouselStore.ts`.
   - Add unit tests for Hero Hungarian matching ($O(N^3)$) and layout ranking.

2. **Plan 12-02: Print Album Full Bleed Spread & Zero-Loss Reflow**
   - Implement `promoteToFullBleedSpread` in `albumStore.ts`.
   - Calculate exact physical coordinates: $x = -\text{bleed}, y = -\text{bleed}, w = \text{spreadWidth} + 2\cdot\text{bleed}, h = \text{spreadHeight} + 2\cdot\text{bleed}$.
   - Implement $(N-1)$ reflow into `createInteriorSpread` + `generateDynamicVariations`.
   - Ensure single-step atomic undo with `useHistoryStore`.
   - Add spine clearance collision detection and non-printing amber guide line HUD.

3. **Plan 12-03: Carousel Seamless Panorama Span Engine & Swipe Projection**
   - Implement `setPanoramaSpan(slideIndex, frameId, spanSlides)` in `carouselStore.ts`.
   - Add auto-slide expansion when spanning at the end of the carousel.
   - Update `PhoneSwipeSimulator.tsx` to project intersecting continuous frames with 100% seam alignment.
   - Add regression tests covering 2-slide and 3-slide panorama spans, zero photo loss, and ratio scaling.

---

## 5. Verification Checklist

- [ ] Right-clicking any photo in Print Album mode opens the studio context menu with `Set as Full Bleed Spread` and `Set as Hero Photo`.
- [ ] Right-clicking any photo in Carousel mode opens the studio context menu with `Set as Seamless Panorama Span (2/3 Slides)` and `Set as Hero Photo`.
- [ ] Full bleed spread expands past trim by exact project bleed ($+3\text{mm} / 0.125\text{in}$).
- [ ] Non-hero photos automatically reflow to a new spread; zero photos are lost.
- [ ] Pressing `⌘Z` once restores the entire album to pre-full-bleed state.
- [ ] 2-slide and 3-slide panoramas swipe seamlessly in `PhoneSwipeSimulator` with zero black gaps or blanks.
- [ ] High-priority hero photos are placed into Slot 0 ($\ge 50\%$ spread area) by Hungarian matcher.
- [ ] Spine binding warning ($X_{\text{spine}} \pm 19\text{mm}$) appears on canvas when a spanning photo's subject crosses the crease, but is absent on export.
- [ ] `npm test` passes 100% with zero TypeScript errors.
