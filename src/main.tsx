import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';
import { loadAlbumFonts } from './domain/bundledFonts';
import { useProjectStore } from './stores/projectStore';
import { useAlbumStore } from './stores/albumStore';
import { useCarouselStore } from './stores/carouselStore';
import { usePhotoStore } from './stores/photoStore';
import { useEditorStore } from './stores/editorStore';
import { useAssetStore } from './stores/assetStore';
import { useAppStore } from './stores/appStore';

if (typeof window !== 'undefined') {
  (window as any).__STORES__ = {
    useProjectStore,
    useAlbumStore,
    useCarouselStore,
    usePhotoStore,
    useEditorStore,
    useAssetStore,
    useAppStore,
  };
}

loadAlbumFonts().catch((error) => console.error('Could not load bundled album fonts', error)).finally(() => {
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

});
