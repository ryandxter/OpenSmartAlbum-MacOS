# Plan 15-01 Summary: SQLite Schema Migration `migrate_v16` & Rust IPC Persistence Layer

**Execution Date:** September 29, 2026  
**Status:** Completed  
**Commits:**
- `73c7dd2`: `feat(db): add migrate_v16 for carousel schema and project_type`
- `5fc9872`: `feat(db, ipc): implement carousel CRUD operations and IPC commands`
- `f2fdb3f`: `feat(package_io): extend package payload and archive serialization with carousel support`

---

## 1. Overview of Executed Work

Plan 15-01 built the core persistence foundation for Social Carousel projects in OpenSmartAlbum-MacOS, transitioning carousels from RAM-only transient state to fully transactional SQLite database storage and portable `.afsn` / `.zip` archive serialization.

### Task 1: Migration `migrate_v16` & Expected Schema Bump
- Bumped `Database::expected_version()` from 15 to 16.
- Added `Self::migrate_v16(conn)?` dispatch inside `Database::run_migrations`.
- Implemented `migrate_v16`:
  - Added `project_type TEXT NOT NULL DEFAULT 'print'` column to `projects`, backfilling existing `canvas_unit = 'px'` projects to `'carousel'`.
  - Created `carousels` table for carousel project-level metadata (`id`, `project_id`, `ratio`, `slide_width_px`, `slide_height_px`, `total_slides`) with `ON DELETE CASCADE` and index on `project_id`.
  - Created `carousel_slides` table (`id`, `project_id`, `slide_index`, `width_px`, `height_px`, `background_color`) with `ON DELETE CASCADE` and indices on `project_id` and `(project_id, slide_index)`.
  - Created `carousel_frames` table with exhaustive layout geometry, photo reference, crop parameters, borders, opacity, lock state, shape types, and per-corner radii, with `ON DELETE CASCADE` and indices on `slide_id` and `photo_id`.
- Extended `ProjectRow` struct with `#[serde(default = "default_project_type")] pub project_type: String`.
- Updated `create_project`, `get_project`, `list_recent_projects`, and `load_album_structure` queries to read and persist `project_type`.

### Task 2: Carousel CRUD Operations & IPC Commands
- Defined camelCase Serde structs:
  - `CarouselFramePayload`
  - `CarouselSlidePayload`
  - `CarouselPayload`
- Implemented `Database::save_carousel_structure` and `Database::save_carousel_in_transaction`:
  - Transaction-safe upsert into `carousels`.
  - Cascading deletion of existing slides and frames.
  - Insertion of slides and frames, verifying photo existence in `photos` table to prevent dangling references.
  - Automatic timestamp update on parent `projects` row.
- Implemented `Database::load_carousel_structure`:
  - Queries `carousels`, `carousel_slides`, and `carousel_frames` sorted by `slide_index` and `(z_index, rowid)`.
  - Returns `Ok(None)` cleanly for non-carousel projects.
- Exposed Tauri IPC commands in `src-tauri/src/commands/project_commands.rs`:
  - `save_carousel_structure`
  - `load_carousel_structure`
- Registered IPC commands in `tauri::generate_handler!` within `src-tauri/src/lib.rs`.

### Task 3: `.afsn` Archive Serialization & Unit Testing
- Extended `ProjectPackagePayload` with `pub carousel: Option<CarouselPayload>`.
- Updated `project_package` to query `load_carousel_structure(project_id)?` and include `carousel` in package payload.
- Updated `store_project_package_with_identity` to clean existing `carousels` and `carousel_slides` and invoke `Self::save_carousel_in_transaction`.
- Updated `remap_identity` for project duplication to generate fresh UUIDs for carousel, slides, and frames, remapping `frame.photo_id` to new photo IDs.
- Updated `export_bundled_project_package_with_progress` to scan carousel frame elements for unreferenced photo files, compress them into `photos/` in the ZIP, and rewrite relative paths.
- Updated `import_project_package` to validate carousel project ownership and resolve relative photo paths.
- Added comprehensive automated unit tests:
  - `test_migrate_v16_and_schema_version`: verifies migration v16, expected schema version 16, and table/index creation.
  - `test_carousel_save_and_load_roundtrip`: verifies 3-slide carousel save and load with frame geometries, crops, borders, and corner radii.
  - `test_carousel_cascading_delete`: verifies deleting a project cascades and purges `carousels`, `carousel_slides`, and `carousel_frames`.
  - `test_carousel_package_export_import_and_bundled_zip`: verifies full `.afsn` export/import cycle and bundled ZIP compression containing `project.afsn` and photos.

---

## 2. Verification Results

- `cargo check`: Passed with 0 warnings, 0 errors.
- `cargo test --lib`: All 47 tests passed (100% green).
- `npx tsc --noEmit`: Clean typecheck across the frontend workspace.

---

## 3. Next Steps (Phase 15 Next Plans)
- **Plan 15-02:** Frontend store integration (`carouselStore.ts`, `projectStore.ts`, `useAutoSave.ts`) to wire up `save_carousel_structure` and `load_carousel_structure`.
- **Plan 15-03:** Autosave engine, dirty state tracking, `AppTitleBar` status indicator (amber/green dot), and native window close confirmation safeguards.
