# NOTICE — Origin & Clean-Room Statement

OpenSmartAlbum is an independent, free and open-source desktop photo album
layout studio (Tauri v2 + React + Rust), released under the MIT License
(see `LICENSE`).

## Origin

This project began from the v1.4.0-era codebase of AFSNSmartAlbum, at a time
when that codebase was developed collaboratively and available as open
source. The original project has since been continued by its owner under a
proprietary license with paid/locked features (upstream:
`asrofims/AFSNSmartAlbum`).

OpenSmartAlbum is the independent continuation of the open-source line:
it keeps the software 100% free, without donation nagware, DRM, license
gates, or closed telemetry.

## Clean-room evolution

Feature parity work after the fork is done as **clean-room implementation**:

- Shipped upstream binaries were observed only from the outside
  (behaviour, UI structure, file formats produced) to write functional
  specifications.
- All post-fork code in this repository was written independently against
  those specifications. No proprietary upstream source code, decompiled
  code, assets, icons, fonts, or branding from the proprietary releases
  are included in this repository.
- Reverse-engineering work files (binaries, extraction dumps) are research
  material kept **outside** this repository and are covered by `.gitignore`
  (`rea/`, `*.exe`, `graphify-out/`, `.planning/`). Do not commit them.

## Trademarks

"AFSNSmartAlbum" is the name of the separate upstream project and is used
here only to describe this project's origin. OpenSmartAlbum is not
affiliated with, endorsed by, or a build of the upstream proprietary
product.

## Third-party software

This project builds on open-source libraries, each under its own license,
including Tauri (MIT / Apache-2.0), React (MIT), Konva (MIT), SQLite
(public domain), Rayon (MIT / Apache-2.0), the `image` crate (MIT), and
`tract` (MIT / Apache-2.0). Bundled fonts in `public/fonts/` are SIL Open
Font License fonts and ship with their OFL license files alongside them.
