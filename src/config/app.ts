export const APP_CONFIG = {
  name: 'OpenSmartAlbum',
  description: 'Professional Photo Album Layout Software',
  projectExtension: '.afsn',
  website: 'https://app.afsun.my.id',
  license: 'Proprietary — All Rights Reserved',
  credits: [
    'Afsunmedia - Asrofims',
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
