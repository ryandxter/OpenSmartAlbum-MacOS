# Phase 18 Context: Direct-Canvas Rich Text Color Bar & Inline Hex Editor

## Phase Goal
Provide a Figma-grade direct-canvas rich text editing experience with a docked formatting toolbar, visible & editable Hex values (`#RGB` / `#RRGGBB`), text background highlight controls, mixed-color detection, and selection preservation during color picking.

## User Decisions & Locked Scope

### 1. Docked Toolbar Placement & UI
- **Docked Position:** Toolbar menempel rapi di bagian atas boundary text box yang sedang diedit (bukan melayang di atas kursor/seleksi), sehingga tetap stabil dan tidak bergoyang saat canvas di-zoom atau di-pan.
- **Visual Style:** Mac dark studio style (`#18181b` surface, `#27272a` border, SF Pro typography, ikon Lucide).
- **Controls Included:**
  - Bold, Italic, Underline toggle buttons.
  - Text Color picker button + editable Hex input field.
  - Text Background (Highlight) picker button + editable Hex input field + 1-click "Clear/Transparent" button.
  - Text alignment (Left, Center, Right, Justify) & Font Size stepper.

### 2. Hex Input & Color Normalization
- **Format Support:** Mendukung input 3-digit `#RGB` (misal `#F00` → dinormalisasi menjadi `#FF0000`) dan 6-digit `#RRGGBB` (misal `#0052B4`).
- **Live Preview & Validation:** Nilai Hex divalidasi secara real-time. Jika valid, warna langsung diaplikasikan ke range teks yang sedang aktif dengan debounce (~100ms) atau saat Enter/Blur.

### 3. Mixed Selection Handling
- **Visual Feedback:** Jika seleksi teks yang diblok berisi kombinasi beberapa warna berbeda, input Hex menampilkan placeholder `Mixed` dan kontrol warna menampilkan swatch multi-warna/gradien.
- **Unselected Span Safety:** Menerapkan warna baru hanya akan mengubah potongan teks yang sedang diblok, tanpa merusak range teks lain di luar seleksi.

### 4. Selection & Focus Preservation
- **No Blur on Picker Click:** Mengklik color picker popover, swatch preset, atau mengetik di input Hex **tidak menghilangkan range selection teks** di canvas (`onMouseDown={(e) => e.preventDefault()}` pada container toolbar).
- **Bidirectional Sync & Undo:** Perubahan warna teks tersinkronisasi dua arah dengan `TypographyPanel.tsx` di Inspector dan tercatat dalam single undo history transaction.

## Verification Criteria
- [ ] Text box inline editing menampilkan docked toolbar di atas kotak teks.
- [ ] Mengetik `#RGB` atau `#RRGGBB` langsung mengubah warna teks yang diblok.
- [ ] Text background highlight dapat diberi warna Hex custom atau di-clear menjadi transparan.
- [ ] Seleksi teks dengan multi-warna menampilkan status `Mixed`.
- [ ] Memilih warna dari popover tidak menghilangkan blok teks di kanvas.
- [ ] Riwayat Undo/Redo mengembalikan format warna dengan sempurna.
