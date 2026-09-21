---
id: SEED-001
status: dormant
planted: 2026-09-21
planted_during: Phase 1
trigger_when: when entering Phase 5 (Advanced Layered Export Suite)
scope: medium
---

# SEED-001: Pure Rust Layered PSD Exporter

## Why This Matters

Currently, OpenSmartAlbum-MacOS only exports flattened raster images (JPEG/PNG) and basic single-layer PDF documents. Photographers and pro studios frequently need to make fine adjustments in Adobe Photoshop before final printing or client delivery (e.g. skin frequency separation, dodge and burn, or manual color correction per photo frame).

Building a pure-Rust layered PSD (`.psd`) serializer allows users to export full layouts where:
1. Each photo frame remains an isolated raster layer.
2. Clipping masks (rounded corners, hexagons, scallops) are preserved as Photoshop alpha layer masks.
3. Text elements remain separate editable raster or vector layers.
4. Canvas background remains on its own background layer.
5. Zero dependency on Adobe Photoshop or proprietary C SDKs, running 100% natively on Apple Silicon and Intel macOS.

## When to Surface

**Trigger:** when entering Phase 5 (Advanced Layered Export Suite)

This seed will surface during `/gsd-new-milestone` or when planning Phase 5 (`/gsd-plan-phase 5`), directing technical spikes on PSD binary format generation.

## Scope Estimate

**Medium** — Requires implementing or integrating a minimal Photoshop specification layer serializer (Header, ColorMode, ImageResources, LayerAndMaskInfo, ImageData) in `src-tauri/src/export_engine/`, handling RLE/PackBits or raw byte compression for layer channels.

## Breadcrumbs

- `src-tauri/src/export_engine/` — Existing export orchestration and fontdue text rasterizer
- `src-tauri/src/commands/export_commands.rs` — Tauri IPC commands for rendering and saving exported spreads
- `.planning/REQUIREMENTS.md` — Requirement `EXPO-01`
- `.planning/ROADMAP.md` — Phase 5: Advanced Layered Export Suite

## Notes

- Explore existing Rust crates such as `psd` (mostly reader) and research open-source lightweight PSD writers (e.g. minipsd, Photoshop File Format specification by Adobe).
- Verify color space handling (sRGB vs AdobeRGB 1998) and DPI metadata embedding in PSD Image Resources block (ID 0x03ED).
