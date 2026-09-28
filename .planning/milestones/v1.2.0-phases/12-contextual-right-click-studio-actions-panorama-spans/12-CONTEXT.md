# Phase 12 Context: Contextual Right-Click Studio Actions & Panorama Span Engine

**Milestone:** v1.2.0: Unlimited Studio Layout & Storytelling Engine  
**Phase:** 12 - Contextual Right-Click Studio Actions & Panorama Span Engine  
**Status:** In Progress  

---

## 1. Objectives

Provide high-efficiency right-click studio commands directly on canvas photo frames (and filmstrip tray items) ala Fundy Designer and Pixellu SmartAlbums:
1. **Set as Full Bleed Spread (2-Page Panorama) [Print Album Mode]**:
   - Promotes the target photo to span the entire spread across left and right pages (including bleed cut and gutter).
   - If other photos exist on the current spread, automatically reflows them to an adjacent spread or appends a new spread so zero photos are lost.
2. **Set as Seamless Panorama Span [Social Carousel Mode]**:
   - Promotes the target photo to seamlessly span across 2 or 3 carousel slides.
   - Slices the photo across slide boundaries with virtual dashed cut guides (`showSliceGuides`).
   - Renders matching virtual slices in each target slide so swipe simulator and exports preserve 100% continuous seam alignment.
3. **Set as Hero / Anchor Photo [Both Modes]**:
   - Designates the selected photo as the primary anchor ($w \cdot h$ maximum slot or $\ge 50\%$ spread area).
   - Dynamically re-runs the generative layout synthesizer (`generator.ts`) prioritizing the hero photo in the dominant slot while harmonizing the remaining $(N-1)$ photos.
4. **Spine Clearance Protection [Print Album Mode]**:
   - When a photo spans across the center spine ($X_{\text{spine}} \pm 0.75\text{ in}$ / $\approx 19\text{ mm}$), ensure visual warning or safe zone clearance so important focal content (e.g. faces or primary subjects) does not get swallowed by physical book binding.

---

## 2. Requirements Mapped
- `CTX-01`: Right-clicking any photo in Print Album mode provides `Set as Full Bleed Spread (2-Page Panorama)`.
- `CTX-02`: Right-clicking any photo in Social Carousel mode provides `Set as Seamless Panorama Span`.
- `CTX-03`: Right-clicking any photo provides `Set as Hero / Anchor Photo`.
- `CTX-04`: Spanning panorama photos enforce print lab safe spine exclusion zones ($X_{\text{spine}} \pm 0.75\text{ in}$).

---

## 3. Invariants
- **Zero-Loss Photo Invariant**: Promoting a photo to full bleed never deletes other photos on the spread; they reflow to a new or adjacent spread.
- **Zero-Blank Frame Guarantee**: No phantom frames created.
- **Single Undo Step**: Contextual actions are wrapped in an atomic snapshot so `Cmd+Z` immediately restores the prior spread layout.
