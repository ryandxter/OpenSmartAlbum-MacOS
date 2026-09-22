# OpenSmartAlbum-MacOS

## Project Vision & Context
OpenSmartAlbum is a professional, native macOS photo album design and social carousel publishing software built on Tauri 2, Rust, React 18, and Konva.js. It provides offline-first, sub-millimeter precision layouting, 300+ DPI print sharpening, layered PSD/TIFF export, and seamless Instagram carousel publishing.

## Milestone v1.1.0 Objectives
Milestone v1.1.0 focuses on completing the end-to-end desktop workflow:
1. Native macOS Finder file and folder drag-and-drop dual ingestion.
2. Full photo placement and hybrid layout generation (per-slide & seamless panorama) in Social Carousel Mode.
3. High-contrast studio layout preview tiles and zero-lag shuffling.
4. Robust vector shape masking (Circle, Hexagon, Star, Heart, Scallop, SVG) with in-shape pan/zoom crop.

## Architecture Constraints
- Tauri 2 + Rust backend (no cloud services, no Node.js/Express in production).
- React 18 + Zustand + Konva.js canvas rendering.
- macOS Human Interface Guidelines (SF Pro typography, neutral dark palette `#18181b`, zero chromatic cast).
- Strict backward compatibility with `.afsn` project format and SQLite persistence.
