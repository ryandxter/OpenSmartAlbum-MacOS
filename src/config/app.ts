export const APP_CONFIG = {
  name: 'OpenSmartAlbum',
  description: '100% Free & Open-Source Professional Desktop Photo Album Layout & Social Studio',
  projectExtension: '.opensmartalbum',
  website: 'https://github.com/opensmartalbum/opensmartalbum',
  license: 'Open Source — MIT / GPLv3 (100% Free & Open-Source, Zero DRM)',
  credits: [
    'OpenSmartAlbum Contributors & Open Source Community',
    'Independent clean-room evolution for macOS',
  ],
  acknowledgements: [
    { name: 'React', url: 'https://react.dev', license: 'MIT' },
    { name: 'Tauri', url: 'https://tauri.app', license: 'MIT/Apache-2.0' },
    { name: 'Vite', url: 'https://vitejs.dev', license: 'MIT' },
    { name: 'Konva.js', url: 'https://konvajs.org', license: 'MIT' },
    { name: 'Zustand', url: 'https://zustand-demo.pmnd.rs', license: 'MIT' },
    { name: 'SQLite', url: 'https://sqlite.org', license: 'Public Domain' },
    { name: 'image', url: 'https://github.com/image-rs/image', license: 'MIT/Apache-2.0' },
  ],
} as const;

export type Acknowledgement = typeof APP_CONFIG.acknowledgements[number];
