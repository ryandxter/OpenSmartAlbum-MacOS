# Changelog — OpenSmartAlbum macOS

All notable changes to **OpenSmartAlbum macOS** are documented in this file.  
Format adheres to [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## 🇮🇩 Bahasa Indonesia • [English Below](#-english)

---

### [v1.5.1] — 2026-10-27
#### 🛠️ Rilis Perbaikan: Resolusi React Error #310, Tab Canva di Preferences & Penyelarasan UI Storage

Pembaruan rilis perbaikan (*hotfix release*) ini menuntaskan isu kritis pembuatan dokumen baru, menambahkan tab integrasi Canva terpusat di Preferences, serta menyelaraskan seluruh variabel pengaturan dengan arsitektur engine v1.5.

#### Perbaikan & Penyempurnaan (Bug Fixes & Enhancements)
* **Resolusi React Error #310 (Hook Order Invariant Violation)**:
  * Memperbaiki pelanggaran aturan Hooks di `FilmstripTray.tsx` dan `KonvaEditorCanvas.tsx` akibat pengembalian kondisional awal (*early return*) sebelum pemanggilan hooks saat proyek baru dibuka atau beralih.
* **Tab Baru Canva & Cloud Integrations di Preferences**:
  * Menghadirkan tab terpadu **Canva & Cloud** di dialog Preferences:
    * Kartu status koneksi akun (Connected / Disconnected).
    * Tombol *Connect Account* via browser OAuth PKCE satu klik dan tombol *Disconnect*.
    * Tombol *Sync Assets* langsung dari dialog pengaturan.
    * Panel verifikasi keamanan dan rincian Production Gateway `auth-osa.rvmeur.com`.
* **Penyelarasan Discrepancy Storage & Cache**:
  * Menghapus duplikasi kartu cache lama di tab *General* dan menyatukannya sebagai ringkasan cerdas yang mengarah ke tab *Storage & Cache*.
  * Menyelaraskan teks native macOS Finder (*"A project file opened directly from Finder takes priority"*).
  * Memperbarui versi rilis internal dan fallback browser secara presisi ke `v1.5.1`.

---

### [v1.5.0] — 2026-10-27
#### 🌟 Rilis Utama: Ekosistem Aset Terbuka, Integrasi Resmi Canva Apps SDK & Zero-Hassle Drag & Drop

Pembaruan besar ini menghadirkan perombakan total pada panel aset elemen dan bingkai foto dekoratif, menghapus seluruh aset placeholder tiruan, dan menambahkan ekosistem aset kelas dunia yang 100% bebas biaya serta terintegrasi resmi dengan Canva Apps SDK.

#### Fitur Baru (New Features)
* **Ekosistem Aset Terbuka (Open Library CC0 & Public Domain)**:
  * Akses instan ke **200.000+ ikon dan vektor ilustrasi** dari repositori terbuka (Lucide, Tabler, Fluent, Twemoji, OpenMoji, HugeIcons, dll.) via OpenSearch API.
  * Dilengkapi tombol chip pencarian cepat (*Wedding*, *Floral*, *Hearts*, *Banners*, *Stars*, *Camera*, *Border*, *Ribbon*, *Vintage*, *Rings*).
  * Auto-rasterisasi SVG ke PNG beresolusi tinggi 2048px dengan subpixel anti-aliasing via crate Rust `resvg`.
  * 100% offline caching di `$APPDATA/frame_assets/`.
* **Integrasi Resmi Canva Apps SDK / Canva Connect API**:
  * Tab khusus **Canva** di Assets Panel dengan autentikasi resmi OAuth 2.0 PKCE.
  * Otorisasi satu klik di browser dengan penangkapan callback otomatis via server lokal ephemeral `127.0.0.1:3001` dan dukungan Auth Gateway `auth-osa.rvmeur.com`.
  * Sinkronisasi live folder dan desain Canva pengguna langsung ke dalam OpenSmartAlbum tanpa risiko blokir akun.
* **Canva-Grade Zero-Hassle Drag & Drop (3 Metode)**:
  * **Metode 1 (Empty Canvas Drop)**: Tarik aset grafis/stiker ke kanvas kosong untuk langsung meletakkan elemen di titik kursor dan mengaktifkan transform box (Konva Transformer) seketika.
  * **Metode 2 (Photo Frame Drop)**: Tarik bingkai dekoratif ke atas bingkai foto yang sudah ada untuk langsung menguncinya sebagai *FrameOverlay* berlubang transparan (*aperture clipping mask*).
  * **Metode 3 (External Finder Drop)**: Tarik file `.svg`, `.png`, `.webp`, `.jpg` langsung dari macOS Finder / Desktop ke kanvas untuk auto-import dan auto-place instan.
* **Starter Asset Pack Offline Nyata**:
  * Mem-bundle 26 aset nyata beresolusi tinggi (11 bingkai vintage dan 15 grafis dekoratif transparan) langsung di dalam bundle aplikasi, menghilangkan seluruh broken placeholder.

#### Peningkatan & Perbaikan (Improvements & Fixes)
* Mengoptimalkan kompilasi TypeScript dan test coverage (337 pengujian domain lolos 100%).
* Menyediakan blueprint spesifikasi Auth Gateway `docs/CANVA_AUTH_GATEWAY_SPEC.md` untuk deployment subdomain `auth-osa.rvmeur.com`.

---

<a name="-english"></a>
## 🇬🇧 English

---

### [v1.5.1] — 2026-10-27
#### 🛠️ Hotfix Release: React Hook Order Invariant Resolution, Canva Preferences Tab & Storage UI Reconciliation

This hotfix release resolves a critical hook order violation when creating new documents, introduces a centralized Canva & Cloud integration tab in Preferences, and eliminates UI storage discrepancies.

#### Fixed & Improved
* **React Error #310 Resolution (Hook Order Invariant Violation)**:
  * Resolved conditional early returns placed prior to hook invocations in `FilmstripTray.tsx` and `KonvaEditorCanvas.tsx` when opening or resetting projects.
* **New Canva & Cloud Integrations Tab in Preferences**:
  * Added unified **Canva & Cloud** tab in the desktop Preferences dialog:
    * Real-time account connection status indicator.
    * One-click browser authorization via OAuth 2.0 PKCE and account disconnection controls.
    * Direct asset catalog synchronization from settings.
    * Production Auth Gateway verification panel (`auth-osa.rvmeur.com`).
* **Preferences & Storage UI Reconciliation**:
  * Removed redundant preview cache card in the *General* tab in favor of a unified overview pointing to the *Storage & Cache* tab.
  * Corrected platform-specific text to native macOS terminology (*"A project file opened directly from Finder takes priority"*).
  * Synchronized internal runtime and fallback versions to `v1.5.1`.

---

### [v1.5.0] — 2026-10-27
#### 🌟 Major Milestone: Open Asset Ecosystem, Official Canva Apps SDK Integration & Zero-Hassle Drag & Drop

This major update brings a complete transformation to decorative photo frames and graphic stickers, replacing all placeholder mockups with a world-class, 100% free asset ecosystem alongside official Canva Connect API integration.

#### Added
* **Open Asset Ecosystem (Open Library CC0 & Public Domain)**:
  * Instant search across **200,000+ open-source icons, vectors, and illustrations** (Lucide, Tabler, Fluent, Twemoji, OpenMoji, HugeIcons, etc.) through native OpenSearch API integration.
  * Quick-search suggestion chips (*Wedding*, *Floral*, *Hearts*, *Banners*, *Stars*, *Camera*, *Border*, *Ribbon*, *Vintage*, *Rings*).
  * Subpixel anti-aliased SVG rasterization up to 2048px PNG via Rust's `resvg` engine.
  * 100% offline-first persistence in `$APPDATA/frame_assets/`.
* **Official Canva Apps SDK / Canva Connect API**:
  * Dedicated **Canva** tab in Assets Panel utilizing official OAuth 2.0 with PKCE.
  * One-click browser authorization with local loopback listener (`127.0.0.1:3001`) and production Auth Gateway support (`auth-osa.rvmeur.com`).
  * Live syncing of user's Canva designs, folders, and uploaded assets directly inside the studio workspace with zero account suspension risks.
* **Canva-Grade Zero-Hassle Drag & Drop (3 Methods)**:
  * **Method 1 (Empty Canvas Drop)**: Drag any graphic/sticker onto empty canvas space to create a `GraphicElement` at cursor coordinates with Konva Transformer immediately activated.
  * **Method 2 (Photo Frame Drop)**: Drag a decorative frame over an existing photo frame to seamlessly bind it as a `FrameOverlay` with automatic aperture clipping.
  * **Method 3 (External Finder Drop)**: Drag `.svg`, `.png`, `.webp`, `.jpg` files directly from macOS Finder / Desktop into the canvas to auto-import and place/bind.
* **Offline Bundled Starter Asset Pack**:
  * 26 high-resolution real assets (11 vintage frames with transparent aperture holes and 15 decorative stickers) pre-packaged directly in the app.

#### Fixed & Optimized
* Eliminated all fake placeholder catalog assets.
* Maintained 100% green test suite across 45 test files and 337 unit/domain tests.
* Added complete Auth Gateway specification at `docs/CANVA_AUTH_GATEWAY_SPEC.md` for `auth-osa.rvmeur.com`.

---

### [v1.4.14] — 2026-10-25
* 100% Clean-room reverse engineering & feature parity with AFSNSmartAlbum v1.4.14.
* Native macOS studio dark theme and HIG compliance.
* Embedded YuNet ONNX face detection inference on Apple Silicon & Intel.
* Zero donation nagware and DRM-free design.

---

### [v1.4.0] — 2026-10-18
* High-DPI physical print export engine (PDF/X-3, 16-bit TIFF, PSD layered masks).
* Social Media Carousel studio mode with multi-slide seamless panoramic frames.
* SQLite relational persistence with WAL journal mode.
