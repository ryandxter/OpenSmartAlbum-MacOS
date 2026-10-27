import { chromium, Browser, Page } from 'playwright';
import { createServer, ViteDevServer } from 'vite';
import * as path from 'path';

// Helper to create photographic SVG data URLs
function createPhotographicSvg(title: string, subtitle: string, bgGradient: string, accentColor: string, iconShape: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
    <defs>
      ${bgGradient}
      <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="30" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
      <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
        <stop offset="40%" stop-color="#000000" stop-opacity="0" />
        <stop offset="100%" stop-color="#000000" stop-opacity="0.45" />
      </radialGradient>
      <linearGradient id="goldGleam" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#fef08a" />
        <stop offset="50%" stop-color="#eab308" />
        <stop offset="100%" stop-color="#ca8a04" />
      </linearGradient>
    </defs>
    <!-- Background Canvas -->
    <rect width="1200" height="800" fill="url(#bg)" />
    <rect width="1200" height="800" fill="url(#vignette)" />

    <!-- Artistic Atmosphere Bokeh -->
    <circle cx="200" cy="180" r="140" fill="${accentColor}" opacity="0.18" filter="url(#softGlow)" />
    <circle cx="1020" cy="220" r="180" fill="${accentColor}" opacity="0.14" filter="url(#softGlow)" />
    <circle cx="600" cy="620" r="220" fill="${accentColor}" opacity="0.12" filter="url(#softGlow)" />

    <!-- Center Composition Illustration -->
    <g transform="translate(600, 360)">
      ${iconShape}
    </g>

    <!-- Editorial Typography Overlay -->
    <g transform="translate(600, 580)" text-anchor="middle">
      <text font-family="'Playfair Display', Georgia, serif" font-size="44" font-weight="600" fill="#ffffff" letter-spacing="4" filter="drop-shadow(0 2px 8px rgba(0,0,0,0.6))">${title}</text>
      <text y="42" font-family="'Montserrat', sans-serif" font-size="20" font-weight="300" fill="#fef08a" letter-spacing="8" opacity="0.95">${subtitle.toUpperCase()}</text>
    </g>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Photographic Mock Data URIs
const bridalPortraitSvg = createPhotographicSvg(
  'The Bridal Silhouette',
  'Fine Art Studio Proof • 85mm f/1.4',
  `<radialGradient id="bg" cx="50%" cy="40%" r="80%">
    <stop offset="0%" stop-color="#2d1b2e" />
    <stop offset="50%" stop-color="#18111e" />
    <stop offset="100%" stop-color="#0a070e" />
  </radialGradient>`,
  '#f472b6',
  `<!-- Bride Silhouette with Floral Halo -->
   <circle cx="0" cy="-60" r="70" fill="#fce7f3" opacity="0.9" />
   <path d="M-120 160 C -100 20, -50 -10, 0 -10 C 50 -10, 100 20, 120 160 Z" fill="#ffffff" opacity="0.95" />
   <!-- Floral Veil Lace -->
   <path d="M-90 -40 C -70 -120, 70 -120, 90 -40 C 130 60, 160 160, 180 220 L -180 220 C -160 160, -130 60, -90 -40 Z" fill="#fbcfe8" opacity="0.35" />
   <!-- Floral Bouquet -->
   <circle cx="0" cy="70" r="45" fill="#f43f5e" opacity="0.8" />
   <circle cx="-25" cy="60" r="30" fill="#fb7185" opacity="0.85" />
   <circle cx="28" cy="65" r="32" fill="#fda4af" opacity="0.85" />
   <circle cx="0" cy="95" r="28" fill="#10b981" opacity="0.75" />`
);

const ceremonyKissSvg = createPhotographicSvg(
  'Golden Hour Vows',
  'Sunset Ceremony • 35mm f/1.8',
  `<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#7c2d12" />
    <stop offset="40%" stop-color="#c2410c" />
    <stop offset="70%" stop-color="#ea580c" />
    <stop offset="100%" stop-color="#f97316" />
  </linearGradient>`,
  '#fef08a',
  `<!-- Couple Silhouette Kissing -->
   <g fill="#18181b">
     <circle cx="-35" cy="-70" r="36" />
     <path d="M-60 140 C -55 20, -45 -10, -25 -25 C -5 -10, 5 30, 10 140 Z" />
     <circle cx="25" cy="-75" r="32" />
     <path d="M-5 140 C 0 20, 15 -15, 30 -25 C 45 -15, 55 10, 65 140 Z" />
   </g>
   <!-- Golden Sun Halo behind Kiss -->
   <circle cx="-5" cy="-72" r="55" fill="#fef08a" opacity="0.65" filter="url(#softGlow)" />`
);

const weddingRingsSvg = createPhotographicSvg(
  'Eternity Bands',
  'Macro Detail • 105mm f/2.8 Micro',
  `<radialGradient id="bg" cx="50%" cy="50%" r="75%">
    <stop offset="0%" stop-color="#064e3b" />
    <stop offset="60%" stop-color="#022c22" />
    <stop offset="100%" stop-color="#01140e" />
  </radialGradient>`,
  '#34d399',
  `<!-- Diamond Rings Interlocked -->
   <circle cx="-35" cy="-20" r="70" fill="none" stroke="url(#goldGleam)" stroke-width="18" filter="drop-shadow(0 4px 12px rgba(0,0,0,0.7))" />
   <circle cx="35" cy="-20" r="70" fill="none" stroke="url(#goldGleam)" stroke-width="18" filter="drop-shadow(0 4px 12px rgba(0,0,0,0.7))" />
   <!-- Diamond Solitaire -->
   <polygon points="-35,-115 -18,-92 -52,-92" fill="#e0f2fe" filter="url(#softGlow)" />
   <polygon points="-35,-115 -18,-92 -35,-80 -52,-92" fill="#38bdf8" opacity="0.8" />
   <!-- Velvet Cushion Shadow -->
   <ellipse cx="0" cy="85" rx="140" ry="25" fill="#01140e" opacity="0.9" filter="url(#softGlow)" />`
);

const firstDanceSvg = createPhotographicSvg(
  'The Midnight Waltz',
  'Grand Ballroom • 50mm f/1.2',
  `<radialGradient id="bg" cx="50%" cy="30%" r="90%">
    <stop offset="0%" stop-color="#1e1b4b" />
    <stop offset="60%" stop-color="#0f172a" />
    <stop offset="100%" stop-color="#020617" />
  </radialGradient>`,
  '#818cf8',
  `<!-- Ballroom Chandelier Silhouette -->
   <g fill="#fbbf24" opacity="0.75" filter="url(#softGlow)">
     <circle cx="0" cy="-140" r="12" />
     <circle cx="-60" cy="-120" r="8" />
     <circle cx="60" cy="-120" r="8" />
     <circle cx="-100" cy="-90" r="6" />
     <circle cx="100" cy="-90" r="6" />
   </g>
   <!-- Dancing Silhouette -->
   <g fill="#ffffff" opacity="0.9">
     <circle cx="-20" cy="-30" r="28" />
     <circle cx="20" cy="-35" r="26" />
     <path d="M-50 140 C -40 30, -25 10, -5 0 C 15 10, 30 30, 40 140 Z" fill="#cbd5e1" />
     <path d="M-10 140 C 5 20, 30 10, 45 0 C 70 20, 110 80, 120 140 Z" fill="#ffffff" opacity="0.95" />
   </g>`
);

// Decorative Frame Overlay SVG (Vintage Gold Oval Aperture)
const vintageGoldFrameSvg = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
  <defs>
    <linearGradient id="goldBorder" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fef08a" />
      <stop offset="25%" stop-color="#eab308" />
      <stop offset="50%" stop-color="#ca8a04" />
      <stop offset="75%" stop-color="#eab308" />
      <stop offset="100%" stop-color="#fef08a" />
    </linearGradient>
    <filter id="frameShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="6" stdDeviation="10" flood-opacity="0.45" />
    </filter>
  </defs>
  <!-- Outer Ornate Frame -->
  <rect x="20" y="20" width="760" height="760" rx="30" fill="none" stroke="url(#goldBorder)" stroke-width="18" filter="url(#frameShadow)" />
  <rect x="36" y="36" width="728" height="728" rx="22" fill="none" stroke="url(#goldBorder)" stroke-width="3" stroke-dasharray="10 6" />

  <!-- Corner Flourish Filigrees -->
  <g fill="url(#goldBorder)">
    <!-- Top-Left -->
    <path d="M 50 50 C 110 50, 110 110, 50 110 C 90 70, 70 90, 50 50 Z" />
    <circle cx="75" cy="75" r="8" />
    <!-- Top-Right -->
    <path d="M 750 50 C 690 50, 690 110, 750 110 C 710 70, 730 90, 750 50 Z" />
    <circle cx="725" cy="75" r="8" />
    <!-- Bottom-Left -->
    <path d="M 50 750 C 110 750, 110 690, 50 690 C 90 730, 70 710, 50 750 Z" />
    <circle cx="75" cy="725" r="8" />
    <!-- Bottom-Right -->
    <path d="M 750 750 C 690 750, 690 690, 750 690 C 710 730, 730 710, 750 750 Z" />
    <circle cx="725" cy="725" r="8" />
  </g>

  <!-- Oval Aperture Inner Trim (Photo shows through transparent center) -->
  <ellipse cx="400" cy="400" rx="320" ry="340" fill="none" stroke="url(#goldBorder)" stroke-width="12" />
  <ellipse cx="400" cy="400" rx="308" ry="328" fill="none" stroke="url(#goldBorder)" stroke-width="2" stroke-dasharray="6 4" />
</svg>
`)}`;

// Sticker / Graphic Element SVG (Golden Flourish Heart)
const goldenHeartFlourishSvg = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
  <defs>
    <linearGradient id="goldElem" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fffbeb" />
      <stop offset="30%" stop-color="#fde047" />
      <stop offset="70%" stop-color="#eab308" />
      <stop offset="100%" stop-color="#a16207" />
    </linearGradient>
    <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#ca8a04" flood-opacity="0.6" />
    </filter>
  </defs>
  <g fill="url(#goldElem)" filter="url(#goldGlow)">
    <!-- Central Sweetheart -->
    <path d="M 200 120 C 200 80, 150 50, 120 80 C 80 120, 160 190, 200 230 C 240 190, 320 120, 280 80 C 250 50, 200 80, 200 120 Z" />
    <!-- Winged Calligraphic Flourishes -->
    <path d="M 120 120 C 60 100, 20 150, 10 180 C 40 160, 80 150, 130 140 Z" />
    <path d="M 280 120 C 340 100, 380 150, 390 180 C 360 160, 320 150, 270 140 Z" />
    <!-- Mini accent stars -->
    <circle cx="200" cy="50" r="5" />
    <circle cx="80" cy="90" r="4" />
    <circle cx="320" cy="90" r="4" />
  </g>
</svg>
`)}`;

// Vector Card SVGs for Open Library tab
function makeVectorCardSvg(iconSvg: string, label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
    <rect width="200" height="200" rx="12" fill="#222226" />
    <g transform="translate(100, 85)" fill="#e4e4e7" stroke="#e4e4e7">
      ${iconSvg}
    </g>
    <text x="100" y="165" text-anchor="middle" font-family="'Inter', sans-serif" font-size="12" font-weight="500" fill="#a1a1aa">${label}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const mockVectors = [
  {
    id: 'ol-1',
    title: 'Floral Wedding Arch',
    category: 'element' as const,
    shape: 'rectangle',
    thumb_path: makeVectorCardSvg('<path d="M-40 40 C -40 -30, 40 -30, 40 40" fill="none" stroke-width="5" /><circle cx="-35" cy="20" r="7" /><circle cx="35" cy="20" r="7" /><circle cx="0" cy="-30" r="9" />', 'Floral Arch'),
    local_path: '',
    remote_url: 'https://example.com/arch.svg',
    is_pro: false,
    tags: ['wedding', 'arch', 'floral'],
  },
  {
    id: 'ol-2',
    title: 'Vintage Ribbon Banner',
    category: 'element' as const,
    shape: 'rectangle',
    thumb_path: makeVectorCardSvg('<path d="M-50 -10 L 50 -10 L 40 15 L -40 15 Z" fill="#facc15" /><path d="M-50 -10 L -65 5 L -40 15 Z" fill="#ca8a04" /><path d="M 50 -10 L 65 5 L 40 15 Z" fill="#ca8a04" />', 'Vintage Ribbon'),
    local_path: '',
    remote_url: 'https://example.com/ribbon.svg',
    is_pro: false,
    tags: ['banner', 'ribbon', 'wedding'],
  },
  {
    id: 'ol-3',
    title: 'Twin Champagne Flutes',
    category: 'element' as const,
    shape: 'rectangle',
    thumb_path: makeVectorCardSvg('<path d="M-25 25 L -25 -5 C -35 -25, -15 -25, -25 -5 Z" fill="none" stroke-width="4" /><path d="M 25 25 L 25 -5 C 15 -25, 35 -25, 25 -5 Z" fill="none" stroke-width="4" />', 'Champagne Toast'),
    local_path: '',
    remote_url: 'https://example.com/toast.svg',
    is_pro: false,
    tags: ['wedding', 'champagne', 'celebrate'],
  },
  {
    id: 'ol-4',
    title: 'Eternity Diamond Ring',
    category: 'element' as const,
    shape: 'circle',
    thumb_path: makeVectorCardSvg('<circle cx="0" cy="10" r="28" fill="none" stroke-width="6" /><polygon points="0,-32 10,-20 -10,-20" fill="#38bdf8" />', 'Diamond Ring'),
    local_path: '',
    remote_url: 'https://example.com/ring.svg',
    is_pro: false,
    tags: ['rings', 'diamond', 'wedding'],
  },
  {
    id: 'ol-5',
    title: 'Botanical Wreath Crest',
    category: 'element' as const,
    shape: 'circle',
    thumb_path: makeVectorCardSvg('<ellipse cx="0" cy="0" rx="36" ry="36" fill="none" stroke-width="3" stroke-dasharray="6 3" /><circle cx="-35" cy="0" r="5" /><circle cx="35" cy="0" r="5" /><circle cx="0" cy="-35" r="5" />', 'Olive Wreath'),
    local_path: '',
    remote_url: 'https://example.com/wreath.svg',
    is_pro: false,
    tags: ['floral', 'wreath', 'botanical'],
  },
  {
    id: 'ol-6',
    title: 'Filigree Flourish Heart',
    category: 'element' as const,
    shape: 'square',
    thumb_path: makeVectorCardSvg('<path d="M0 10 C 0 -10, -20 -25, -35 -10 C -55 10, 0 45, 0 45 C 0 45, 55 10, 35 -10 C 20 -25, 0 -10, 0 10 Z" fill="#f43f5e" />', 'Heart Flourish'),
    local_path: '',
    remote_url: 'https://example.com/heart.svg',
    is_pro: false,
    tags: ['hearts', 'love', 'wedding'],
  },
];

async function captureV150Preview() {
  console.log('🌟 Launching AAS Studio Snapshot Engine for OpenSmartAlbum v1.5.0...');

  const server: ViteDevServer = await createServer({
    server: { port: 5184, host: '127.0.0.1' },
    configFile: path.resolve(process.cwd(), 'vite.config.ts'),
  });
  await server.listen();
  console.log('⚡ Vite Studio Server listening on http://127.0.0.1:5184');

  const browser: Browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 2, // Ultra Retina 3200x2000 output
  });

  const page: Page = await context.newPage();

  // Polyfill Tauri IPC bridge
  await page.addInitScript(() => {
    (window as any).__TAURI_INTERNALS__ = (window as any).__TAURI_INTERNALS__ || {};
    (window as any).__TAURI_INTERNALS__.convertFileSrc = (filePath: string) => filePath;
    (window as any).__TAURI_INTERNALS__.invoke = (cmd: string, args: any) => {
      if (cmd === 'get_app_info') {
        return Promise.resolve({
          name: 'OpenSmartAlbum',
          version: '1.5.0',
          tauriVersion: '2.0.0',
        });
      }
      if (cmd === 'list_cached_frame_assets') {
        return Promise.resolve([]);
      }
      if (cmd === 'get_canva_auth_status') {
        return Promise.resolve({
          is_connected: true,
          display_name: 'Studio Pro (Canva Team)',
        });
      }
      return Promise.resolve({});
    };
  });

  try {
    await page.goto('http://127.0.0.1:5184', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);

    // Inject Authentic State into Zustand Stores
    await page.evaluate(
      ({
        bridalPortraitSvg,
        ceremonyKissSvg,
        weddingRingsSvg,
        firstDanceSvg,
        vintageGoldFrameSvg,
        goldenHeartFlourishSvg,
        mockVectors,
      }) => {
        const {
          useProjectStore,
          usePhotoStore,
          useAlbumStore,
          useEditorStore,
          useAssetStore,
          useAppStore,
        } = (window as any).__STORES__;

        // 1. App Store Mode & Preferences
        useAppStore.setState({
          activeMode: 'print',
          printZoom: 1.0,
        });

        // 2. Active Project
        const currentProject = {
          id: 'proj-wedding-v150',
          name: 'Sarah & Michael — Fine Art Wedding Album',
          canvasWidth: 300,
          canvasHeight: 300,
          canvasUnit: 'mm',
          canvasDpi: 300,
          spacingValue: 6,
          spacingUnit: 'mm',
          marginValue: 12,
          marginUnit: 'mm',
          marginEnabled: true,
          bleedValue: 3,
          bleedUnit: 'mm',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        useProjectStore.setState({ currentProject, error: null });

        // 3. Photo Library with Face Telemetry
        const mockPhotos = [
          {
            id: 'photo-bridal',
            projectId: 'proj-wedding-v150',
            fileName: 'bridal-couture-portrait.jpg',
            filePath: bridalPortraitSvg,
            width: 3000,
            height: 3000,
            fileSize: 6200000,
            thumbnailPath: bridalPortraitSvg,
            previewPath: bridalPortraitSvg,
            updatedAt: '2026-10-27',
          },
          {
            id: 'photo-ceremony',
            projectId: 'proj-wedding-v150',
            fileName: 'sunset-ceremony-kiss.jpg',
            filePath: ceremonyKissSvg,
            width: 3000,
            height: 2000,
            fileSize: 5800000,
            thumbnailPath: ceremonyKissSvg,
            previewPath: ceremonyKissSvg,
            updatedAt: '2026-10-27',
          },
          {
            id: 'photo-rings',
            projectId: 'proj-wedding-v150',
            fileName: 'diamond-rings-macro.jpg',
            filePath: weddingRingsSvg,
            width: 3000,
            height: 2000,
            fileSize: 4900000,
            thumbnailPath: weddingRingsSvg,
            previewPath: weddingRingsSvg,
            updatedAt: '2026-10-27',
          },
          {
            id: 'photo-dance',
            projectId: 'proj-wedding-v150',
            fileName: 'ballroom-first-dance.jpg',
            filePath: firstDanceSvg,
            width: 3000,
            height: 2000,
            fileSize: 5400000,
            thumbnailPath: firstDanceSvg,
            previewPath: firstDanceSvg,
            updatedAt: '2026-10-27',
          },
        ];

        // 4. YuNet ONNX Face Telemetry Map
        const faceDataMap = {
          'photo-bridal': {
            photoId: 'photo-bridal',
            faceCount: 1,
            heroScore: 0.984,
            sharpness: 98.4,
            isHero: true,
            faces: [
              {
                x: 0.45,
                y: 0.28,
                width: 0.2,
                height: 0.24,
                score: 0.99,
                sharpness: 98.4,
                rollAngle: -1.2,
              },
            ],
          },
          'photo-ceremony': {
            photoId: 'photo-ceremony',
            faceCount: 2,
            heroScore: 0.991,
            sharpness: 99.1,
            isHero: true,
            faces: [
              { x: 0.42, y: 0.32, width: 0.16, height: 0.2, score: 0.98, sharpness: 99.1 },
              { x: 0.54, y: 0.33, width: 0.15, height: 0.19, score: 0.97, sharpness: 98.8 },
            ],
          },
          'photo-dance': {
            photoId: 'photo-dance',
            faceCount: 2,
            heroScore: 0.965,
            sharpness: 96.5,
            isHero: false,
          },
        };

        usePhotoStore.setState({
          photos: mockPhotos,
          faceDataMap,
          isScanning: false,
        });

        // 5. Album Elements (Frames + FrameOverlay + Graphic Element)
        // Left Page: Full Portrait with Vintage Gold Decorative Frame Overlay
        const leftFrame = {
          id: 'frame-bridal-overlay',
          type: 'photo',
          photoId: 'photo-bridal',
          filePath: bridalPortraitSvg,
          previewPath: bridalPortraitSvg,
          thumbnailPath: bridalPortraitSvg,
          fileName: 'bridal-couture-portrait.jpg',
          x: 18,
          y: 18,
          width: 264,
          height: 264,
          rotation: 0,
          zIndex: 1,
          photoAspect: 1,
          cropX: 0,
          cropY: 0,
          cropScale: 1.0,
          cropRotation: 0,
          borderEnabled: false,
          borderWidth: 0,
          borderColor: '#ffffff',
          cornerRadius: 0,
          opacity: 1,
          // Decorative Frame Overlay (AST-01)
          frameAssetId: 'frame-vintage-gold',
          frameAssetUrl: vintageGoldFrameSvg,
          frameAssetSlot: {
            slotX: 18,
            slotY: 18,
            slotWidth: 264,
            slotHeight: 264,
            shape: 'oval',
          },
          frameAssetOpacity: 1,
        };

        // Right Page Top: Sunset Ceremony Kiss
        const rightFrame1 = {
          id: 'frame-ceremony-kiss',
          type: 'photo',
          photoId: 'photo-ceremony',
          filePath: ceremonyKissSvg,
          previewPath: ceremonyKissSvg,
          thumbnailPath: ceremonyKissSvg,
          fileName: 'sunset-ceremony-kiss.jpg',
          x: 318,
          y: 18,
          width: 264,
          height: 126,
          rotation: 0,
          zIndex: 2,
          photoAspect: 3 / 2,
          cropX: 0,
          cropY: 0,
          cropScale: 1.0,
          cropRotation: 0,
          borderEnabled: true,
          borderWidth: 0.5,
          borderColor: '#e4e4e7',
          cornerRadius: 4,
          opacity: 1,
        };

        // Right Page Bottom-Left: Rings Macro
        const rightFrame2 = {
          id: 'frame-rings-macro',
          type: 'photo',
          photoId: 'photo-rings',
          filePath: weddingRingsSvg,
          previewPath: weddingRingsSvg,
          thumbnailPath: weddingRingsSvg,
          fileName: 'diamond-rings-macro.jpg',
          x: 318,
          y: 156,
          width: 126,
          height: 126,
          rotation: 0,
          zIndex: 3,
          photoAspect: 3 / 2,
          cropX: 0,
          cropY: 0,
          cropScale: 1.0,
          cropRotation: 0,
          borderEnabled: true,
          borderWidth: 0.5,
          borderColor: '#e4e4e7',
          cornerRadius: 4,
          opacity: 1,
        };

        // Right Page Bottom-Right: First Dance
        const rightFrame3 = {
          id: 'frame-first-dance',
          type: 'photo',
          photoId: 'photo-dance',
          filePath: firstDanceSvg,
          previewPath: firstDanceSvg,
          thumbnailPath: firstDanceSvg,
          fileName: 'ballroom-first-dance.jpg',
          x: 456,
          y: 156,
          width: 126,
          height: 126,
          rotation: 0,
          zIndex: 4,
          photoAspect: 3 / 2,
          cropX: 0,
          cropY: 0,
          cropScale: 1.0,
          cropRotation: 0,
          borderEnabled: true,
          borderWidth: 0.5,
          borderColor: '#e4e4e7',
          cornerRadius: 4,
          opacity: 1,
        };

        // Canva-Grade Drag & Drop Graphic Element with Transformer
        const stickerElement = {
          id: 'sticker-gold-flourish',
          type: 'graphic',
          name: 'Golden Heart Flourish',
          x: 410,
          y: 110,
          width: 80,
          height: 60,
          rotation: -5,
          zIndex: 10,
          opacity: 0.95,
          frameAssetId: 'elem-heart-flourish',
          frameAssetUrl: goldenHeartFlourishSvg,
          frameAssetLocalPath: goldenHeartFlourishSvg,
          frameAssetTitle: 'Golden Heart Flourish',
          shadowEnabled: true,
          shadowBlur: 12,
          shadowOpacity: 0.4,
          shadowColor: '#000000',
        };

        const mockSpread = {
          id: 'spread-1',
          spreadIndex: 0,
          type: 'interior',
          name: 'Spread 1-2',
          leftPage: {
            id: 'page-1',
            pageNumber: 1,
            type: 'left',
            width: 300,
            height: 300,
            unit: 'mm',
            bleed: 3,
            safeArea: 12,
            backgroundColor: '#ffffff',
            backgroundType: 'solid',
          },
          rightPage: {
            id: 'page-2',
            pageNumber: 2,
            type: 'right',
            width: 300,
            height: 300,
            unit: 'mm',
            bleed: 3,
            safeArea: 12,
            backgroundColor: '#ffffff',
            backgroundType: 'solid',
          },
          gutterWidth: 0,
          gutterUnit: 'mm',
          bleed: 3,
          safeArea: 12,
          spacingValue: 6,
          spacingUnit: 'mm',
          backgroundColor: '#ffffff',
          elements: [leftFrame, rightFrame1, rightFrame2, rightFrame3, stickerElement],
        };

        const mockAlbum = {
          id: 'album-wedding',
          projectId: 'proj-wedding-v150',
          spreads: [mockSpread],
          activeSpreadId: 'spread-1',
        };

        useAlbumStore.setState({
          currentAlbum: mockAlbum,
          activeSpreadId: 'spread-1',
        });

        // 6. Select the Graphic Sticker to reveal Konva Transformer
        useEditorStore.setState({
          selectedFrameIds: ['sticker-gold-flourish'],
          selectedElementIds: ['sticker-gold-flourish'],
        });

        // 7. Assets Panel State (Open Library 200k+ CC0 tab)
        useAssetStore.setState({
          activeTab: 'openlibrary',
          searchQuery: 'wedding romance',
          openLibraryResults: mockVectors,
          canvaStatus: {
            is_connected: true,
            display_name: 'Studio Pro (Canva Team)',
          },
          isLoading: false,
          isOpenSearching: false,
        });
      },
      {
        bridalPortraitSvg,
        ceremonyKissSvg,
        weddingRingsSvg,
        firstDanceSvg,
        vintageGoldFrameSvg,
        goldenHeartFlourishSvg,
        mockVectors,
      }
    );

    await page.waitForTimeout(1000);

    // Click tab "assets" on Inspector
    const assetTabBtn = await page.$(
      'button[title*="Assets"], button[aria-label*="Assets"], button:has-text("Assets")'
    );
    if (assetTabBtn) {
      await assetTabBtn.click();
      await page.waitForTimeout(600);
    } else {
      // Find button by icon or index
      const buttons = await page.$$('button');
      for (const btn of buttons) {
        const title = await btn.getAttribute('title');
        if (title && (title.includes('Frames & Graphic Assets') || title.includes('Assets'))) {
          await btn.click();
          break;
        }
      }
    }

    // Dismiss any modal dialog or toast if visible
    const modalClose = await page.$('button:has-text("Cancel"), button:has-text("Dismiss"), button:has-text("Close")');
    if (modalClose) {
      await modalClose.click();
      await page.waitForTimeout(300);
    }

    // Trigger Fit to Screen to perfectly center the album spread in the studio workspace
    const fitButtons = await page.$$('button');
    for (const btn of fitButtons) {
      const text = await btn.textContent();
      if (text && text.trim() === 'Fit') {
        await btn.click();
        break;
      }
    }

    await page.waitForTimeout(2500);

    const outputPath = path.resolve(process.cwd(), 'assets/preview.jpg');
    await page.screenshot({ path: outputPath, type: 'jpeg', quality: 96 });
    console.log(`🎉 100% Authentic v1.5.0 Studio Preview saved successfully to: ${outputPath}`);
  } finally {
    await browser.close();
    await server.close();
  }
}

captureV150Preview().catch((err) => {
  console.error('Error generating v1.5.0 preview:', err);
  process.exit(1);
});
