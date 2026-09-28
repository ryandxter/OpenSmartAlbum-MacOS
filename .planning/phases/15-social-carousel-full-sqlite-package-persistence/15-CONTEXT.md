# Phase 15 Context: Social Carousel Full SQLite & Package Persistence

**Phase Goal:** Implement SQLite schema tables and `.afsn` archive serialization for Social Carousel projects, dirty state tracking, and window close safeguards to eliminate carousel data loss.

---

## 1. Locked Implementation Decisions

### 1.1 Storage Architecture & Data Schema
- **Relational Schema in SQLite:** Structured tables `carousel_slides` (id, project_id, index, background_color, aspect_ratio, created_at, updated_at) and `carousel_frames` (id, slide_id, photo_id, x, y, width, height, rotation, z_index, crop_data, border_data, shape_type, corner_radii) with foreign keys and cascading delete on slide/project deletion.
- **Archive Package Serialization:** Stored as a dedicated `carousel.json` file placed at the root of the `.afsn` zip package, alongside `project.json` and `album.json`.
- **Project Paradigm:** **Exclusive Mode Projects** — Projects are established at creation time as either `'print'` (Print Album) or `'carousel'` (Social Carousel). This fundamentally simplifies state synchronization, persistence boundaries, and UI chrome.

### 1.2 Autosave & Dirty State Management
- **Autosave Timing:** Debounced 2–3 seconds after any slide/frame alteration, plus immediate persistence on `Cmd+S`, menu Save, or application window blur/deactivation.
- **Visual Status Feedback:** The center pill in `AppTitleBar` displays an amber glowing status dot (`#F59E0B`) with `"Unsaved Changes"` while dirty, switching to green (`#10B981`) `"Saved"` once SQLite/archive write completes.
- **Close & Quit Protection:** Attempting to close the window or quit the application (`Cmd+W`, `Cmd+Q`, window red button) while changes are unsaved presents a native macOS sheet dialog with `Save`, `Don't Save`, and `Cancel`.

### 1.3 Backward Compatibility & Thumbnail Caching
- **Schema Migration:** Defensive startup migrations automatically create `carousel_slides` and `carousel_frames` if absent; opening older projects without carousel data gracefully initializes with a default 3-slide template only if opened as a carousel project.
- **Thumbnail Persistence:** On save, the application renders and caches a high-fidelity PNG thumbnail of slide 1 (`cover`) to disk for instant preview in the Recent Projects browser.

---

## 2. Requirements Mapped to Phase 15
- `PERS-01`: SQLite schema tables for carousel slides, frames, aspect ratios, backgrounds, and order.
- `PERS-02`: Project save (`Cmd+S`, menu Save, autosave) persists carousel state without loss.
- `PERS-03`: Project reopen from `.afsn` or SQLite restores full carousel slide deck.
- `PERS-04`: Dirty state tracking (`isDirty`), title bar indicator, and native window close confirmation.
