# Requirements: OpenSmartAlbum-MacOS Milestone v1.4.0

## Milestone v1.4.0: Workflow & Canvas Precision Suite

### 1. Direct-Canvas Rich Text & Inline Color Bar (TXT)
- [ ] **TXT-01**: User can format text color with a direct-canvas floating color bar featuring an editable Hex input field supporting `#RGB` (3-digit) and `#RRGGBB` (6-digit) values.
- [ ] **TXT-02**: User can format text background highlight per character/word span with live Hex input and color presets.
- [ ] **TXT-03**: System detects and clearly indicates `Mixed` status when the active text selection contains multiple different text colors or background highlights.
- [ ] **TXT-04**: Active text selection on canvas is preserved without losing focus or range bounds when clicking the color picker or typing in Hex inputs.
- [ ] **TXT-05**: Inline text formatting changes synchronize bidirectionally with the Inspector's TypographyPanel and record into Undo/Redo history.

### 2. Adaptive Layout Decorative & Overlay Exclusion (EXC)
- [ ] **EXC-01**: User can toggle `excludeFromAdaptiveLayout` on photo frames (logos, watermarks, stamps) so they are preserved in place during Spacebar layout shuffle and auto-layout generation while remaining fully editable.
- [ ] **EXC-02**: Adaptive layout engine calculates available zones around excluded and locked frames without geometric collision or unwanted empty gaps.
- [ ] **EXC-03**: Pressing keyboard shortcut `S` with a single photo frame selected reveals/activates its photo swap handle, and pressing `S` with two photo frames selected immediately swaps their photos.

### 3. Quick Guides & Snapping Popover (GUD)
- [ ] **GUD-01**: User can open a dedicated Guides & Snapping quick popover from a settings button located beside the Spread/Post counter in the bottom navigator bar.
- [ ] **GUD-02**: User can toggle canvas guides visibility, bleed allowance lines, safe zone margins, magnetic snapping master switch, and snapping distance threshold directly from the popover without opening the global preferences modal.

### 4. Direct Wheel & Trackpad Horizontal Scroll (NAV)
- [ ] **NAV-01**: User can scroll the bottom Spread/Post thumbnail drawer horizontally using direct mouse-wheel vertical delta (`deltaY`) or trackpad scrolling without holding the Shift key.
- [ ] **NAV-02**: Thumbnail drawer horizontal scrolling preserves spread/slide drag-and-drop reordering without gesture collision.

### 5. Visual Studio Layers Management & Reordering Panel (LAY)
- [ ] **LAY-01**: User can view a dedicated Studio Layers panel listing all elements (photos, text, vector shapes) on the active spread/slide with thumbnail previews and type badges.
- [ ] **LAY-02**: User can reorder elements' z-index via drag-and-drop within the Layers panel with a responsive pointer lifecycle and midpoint crossing insertion indicator.
- [ ] **LAY-03**: User can multi-select layer cards to drag and reorder them as a unified block.
- [ ] **LAY-04**: User can toggle lock/unlock and visibility (hide/show) directly on individual layer cards.

### 6. Sub-Pixel Hairline Border Scaling Parity (BOR)
- [ ] **BOR-01**: Ultra-thin photo borders (0.02 - 0.1 mm/pt) render with exact proportional sub-pixel scaling in Export Preview, eliminating artificial 2-device-pixel minimum constraints.
- [ ] **BOR-02**: Border rendering logic maintains strict visual parity across Editor Canvas, Page Navigator thumbnails, and Native Print/Export Preview.

---

## Future Requirements (Deferred to v1.5.0+)
- **AI-01**: On-device YuNet face detection & 5-point landmark detection engine for smart photo framing rules (captured in `.planning/todos/pending/2026-10-02-integrasi-yunet-face-detection-ai-framing-rules.md`).
- **PRF-01**: Client proofing export with interactive annotation markers and approval selection list.

---

## Out of Scope
- Cloud synchronization or web-hosted real-time collaboration (offline-first architecture constraint).
- Proprietary proprietary binary font format transcoding (all standard TTF/OTF/WOFF/WOFF2 system fonts supported natively).

---

## Traceability Matrix

| Requirement | Phase | Status |
| :--- | :--- | :--- |
| TXT-01..TXT-05 | Phase 18: Direct-Canvas Rich Text Color Bar & Inline Hex Editor | Pending |
| EXC-01..EXC-03 | Phase 19: Adaptive Layout Decorative Exclusion & Photo Swap Shortcut | Pending |
| GUD-01..GUD-02, NAV-01..NAV-02 | Phase 20: Quick Guides & Snapping Popover + Direct Drawer Wheel Scroll | Pending |
| LAY-01..LAY-04 | Phase 21: Visual Studio Layers Management & Reordering Panel | Pending |
| BOR-01..BOR-02 | Phase 22: Sub-Pixel Hairline Border Scaling Parity | Pending |
