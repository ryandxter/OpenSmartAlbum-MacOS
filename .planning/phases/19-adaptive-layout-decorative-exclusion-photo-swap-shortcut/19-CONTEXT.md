# Phase 19 Context: Adaptive Layout Decorative Exclusion & Photo Swap Shortcut

## Phase Goal
Enable decorative elements (logos, watermarks, stamps) to coexist seamlessly with adaptive layout generation via `excludeFromAdaptiveLayout`, and enhance keyboard shortcut `S` for swap handle activation and instant 2-frame swapping.

## User Decisions & Locked Scope

### 1. Decorative & Overlay Exclusion (`excludeFromAdaptiveLayout`)
- **Inspector Toggle:** Di Inspector panel untuk elemen foto/gambar, sediakan toggle "Exclude from Adaptive Layout" (dengan ikon Shield/Pin).
- **Layout Partition Behavior:**
  - Saat pengguna menekan `Spacebar` untuk shuffle variasi layout di `adaptiveLayout.ts`, elemen dengan `excludeFromAdaptiveLayout: true` **tetap diam di posisi dan ukuran aslinya** (tidak ikut teracak/tergeser).
  - Algoritma R-BSP dan Spatial Subtraction memperlakukan elemen ini sebagai obstacle yang tidak boleh ditabrak oleh foto-foto unlocked lainnya.
  - Elemen tetap dapat digeser, diubah ukurannya, atau diedit secara manual oleh pengguna kapan saja (tidak terkunci / `locked: false`).

### 2. Photo Swap Shortcut `S` Enhancement
- **Single Photo Selection:** Jika tepat 1 frame foto terpilih dan pengguna menekan tombol `S`, swap ring handle langsung muncul/terfokus, memungkinkan user langsung drag swap ke frame lain.
- **Dual Photo Selection:** Jika 2 frame foto terpilih dan pengguna menekan tombol `S`, sistem langsung menukar foto di kedua frame tersebut secara instan dengan animasi umpan balik halus dan 1 transaksi undo.

## Verification Criteria
- [ ] Toggle `excludeFromAdaptiveLayout` tersedia di Inspector.
- [ ] Spacebar layout cycling tidak memindahkan elemen bertanda excluded.
- [ ] Foto unlocked lain mengisi area kosong di sekitar excluded element tanpa overlap.
- [ ] Menekan `S` pada 1 foto memunculkan swap handle.
- [ ] Menekan `S` pada 2 foto langsung menukar posisi foto keduanya.
