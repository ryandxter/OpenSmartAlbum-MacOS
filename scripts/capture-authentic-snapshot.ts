import { chromium, Browser, Page } from 'playwright';
import { createServer, ViteDevServer } from 'vite';
import * as path from 'path';

async function run() {
  console.log('📸 Generating 100% authentic app snapshot...');

  const server: ViteDevServer = await createServer({
    server: { port: 5183, host: '127.0.0.1' },
    configFile: path.resolve(process.cwd(), 'vite.config.ts'),
  });
  await server.listen();
  console.log('🌐 Vite running on http://127.0.0.1:5183');

  const browser: Browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });

  const page: Page = await context.newPage();

  // Polyfill Tauri internals in headless browser
  await page.addInitScript(() => {
    (window as any).__TAURI_INTERNALS__ = (window as any).__TAURI_INTERNALS__ || {};
    (window as any).__TAURI_INTERNALS__.convertFileSrc = (filePath: string) => filePath;
    (window as any).__TAURI_INTERNALS__.invoke = (cmd: string) => {
      if (cmd === 'get_app_info') {
        return Promise.resolve({
          name: 'OpenSmartAlbum',
          version: '1.2.4',
          tauriVersion: '2.0.0',
        });
      }
      return Promise.resolve({});
    };
  });

  try {
    await page.goto('http://127.0.0.1:5183', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    await page.evaluate(() => {
      const { useProjectStore, usePhotoStore, useAlbumStore, useEditorStore } = (window as any).__STORES__;

      const currentProject = {
        id: 'proj-wedding-demo',
        name: 'Sarah & Michael — Fine Art Wedding Album',
        canvasWidth: 300,
        canvasHeight: 300,
        canvasUnit: 'mm',
        canvasDpi: 300,
        spacingValue: 5,
        spacingUnit: 'mm',
        marginValue: 12,
        marginUnit: 'mm',
        marginEnabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      useProjectStore.setState({ currentProject, error: null });

      const mockPhotos = [
        {
          id: 'photo-1',
          projectId: 'proj-wedding-demo',
          fileName: 'ceremony-kiss.jpg',
          filePath: '/photos/ceremony-kiss.jpg',
          width: 3000,
          height: 2000,
          fileSize: 4500000,
          thumbnailPath: '/thumbnails/photo1.jpg',
          previewPath: '/previews/photo1.jpg',
          updatedAt: '2026-09-23',
        },
        {
          id: 'photo-2',
          projectId: 'proj-wedding-demo',
          fileName: 'bridal-portrait.jpg',
          filePath: '/photos/bridal-portrait.jpg',
          width: 2000,
          height: 3000,
          fileSize: 5200000,
          thumbnailPath: '/thumbnails/photo2.jpg',
          previewPath: '/previews/photo2.jpg',
          updatedAt: '2026-09-23',
        },
        {
          id: 'photo-3',
          projectId: 'proj-wedding-demo',
          fileName: 'rings-macro.jpg',
          filePath: '/photos/rings-macro.jpg',
          width: 3000,
          height: 2000,
          fileSize: 4100000,
          thumbnailPath: '/thumbnails/photo3.jpg',
          previewPath: '/previews/photo3.jpg',
          updatedAt: '2026-09-23',
        },
        {
          id: 'photo-4',
          projectId: 'proj-wedding-demo',
          fileName: 'reception-dance.jpg',
          filePath: '/photos/reception-dance.jpg',
          width: 3000,
          height: 2000,
          fileSize: 4800000,
          thumbnailPath: '/thumbnails/photo4.jpg',
          previewPath: '/previews/photo4.jpg',
          updatedAt: '2026-09-23',
        },
      ];
      usePhotoStore.setState({ photos: mockPhotos, isScanning: false });

      const frame1 = {
        id: 'frame-1',
        type: 'photo',
        photoId: 'photo-2',
        filePath: '/photos/bridal-portrait.jpg',
        previewPath: '/previews/photo2.jpg',
        thumbnailPath: '/thumbnails/photo2.jpg',
        fileName: 'bridal-portrait.jpg',
        x: 18,
        y: 18,
        width: 264,
        height: 264,
        rotation: 0,
        zIndex: 1,
        photoAspect: 2 / 3,
        cropX: 0,
        cropY: 0,
        cropScale: 1.0,
        cropRotation: 0,
        borderEnabled: false,
        borderWidth: 0,
        borderColor: '#ffffff',
        cornerRadius: 0,
        opacity: 1,
      };

      const frame2 = {
        id: 'frame-2',
        type: 'photo',
        photoId: 'photo-1',
        filePath: '/photos/ceremony-kiss.jpg',
        previewPath: '/previews/photo1.jpg',
        thumbnailPath: '/thumbnails/photo1.jpg',
        fileName: 'ceremony-kiss.jpg',
        x: 318,
        y: 18,
        width: 264,
        height: 128,
        rotation: 0,
        zIndex: 2,
        photoAspect: 3 / 2,
        cropX: 0,
        cropY: 0,
        cropScale: 1.0,
        cropRotation: 0,
        borderEnabled: false,
        borderWidth: 0,
        borderColor: '#ffffff',
        cornerRadius: 0,
        opacity: 1,
      };

      const frame3 = {
        id: 'frame-3',
        type: 'photo',
        photoId: 'photo-3',
        filePath: '/photos/rings-macro.jpg',
        previewPath: '/previews/photo3.jpg',
        thumbnailPath: '/thumbnails/photo3.jpg',
        fileName: 'rings-macro.jpg',
        x: 318,
        y: 154,
        width: 128,
        height: 128,
        rotation: 0,
        zIndex: 3,
        photoAspect: 3 / 2,
        cropX: 0,
        cropY: 0,
        cropScale: 1.0,
        cropRotation: 0,
        borderEnabled: false,
        borderWidth: 0,
        borderColor: '#ffffff',
        cornerRadius: 0,
        opacity: 1,
      };

      const frame4 = {
        id: 'frame-4',
        type: 'photo',
        photoId: 'photo-4',
        filePath: '/photos/reception-dance.jpg',
        previewPath: '/previews/photo4.jpg',
        thumbnailPath: '/thumbnails/photo4.jpg',
        fileName: 'reception-dance.jpg',
        x: 454,
        y: 154,
        width: 128,
        height: 128,
        rotation: 0,
        zIndex: 4,
        photoAspect: 3 / 2,
        cropX: 0,
        cropY: 0,
        cropScale: 1.0,
        cropRotation: 0,
        borderEnabled: false,
        borderWidth: 0,
        borderColor: '#ffffff',
        cornerRadius: 0,
        opacity: 1,
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
        spacingValue: 5,
        spacingUnit: 'mm',
        backgroundColor: '#ffffff',
        elements: [frame1, frame2, frame3, frame4],
      };

      const mockAlbum = {
        id: 'album-demo',
        projectId: 'proj-wedding-demo',
        spreads: [mockSpread],
        activeSpreadId: 'spread-1',
      };

      useAlbumStore.setState({
        currentAlbum: mockAlbum,
        activeSpreadId: 'spread-1',
      });

      useEditorStore.setState({
        selectedElementIds: ['frame-1'],
      });
    });

    await page.waitForTimeout(800);

    // Dismiss any modal dialog if present
    const modalBtn = await page.$('button:has-text("OK"), button:has-text("Cancel")');
    if (modalBtn) {
      await modalBtn.click();
      await page.waitForTimeout(500);
    }

    // Dismiss toast if any
    const dismissBtn = await page.$('button:has-text("Dismiss"), span:has-text("Dismiss")');
    if (dismissBtn) {
      await dismissBtn.click();
      await page.waitForTimeout(300);
    }

    // Re-verify error is cleared
    await page.evaluate(() => {
      const { useProjectStore } = (window as any).__STORES__;
      useProjectStore.setState({ error: null });
    });

    // Click "Fit" button in canvas controls to auto-center the spread
    const fitButtons = await page.$$('button');
    for (const btn of fitButtons) {
      const text = await btn.textContent();
      if (text && text.trim() === 'Fit') {
        await btn.click();
        break;
      }
    }

    // Wait 2 seconds for Konva rendering
    await page.waitForTimeout(2000);

    const outputPath = path.resolve(process.cwd(), 'assets/preview.jpg');
    await page.screenshot({ path: outputPath, type: 'jpeg', quality: 95 });
    console.log(`✅ Authentic preview saved to: ${outputPath}`);
  } finally {
    await browser.close();
    await server.close();
  }
}

run().catch((err) => {
  console.error('Error generating preview:', err);
  process.exit(1);
});
