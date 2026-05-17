import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const appIconSource = fileURLToPath(new URL('../../buildResources/icon.png', import.meta.url));
const appIconPublic = fileURLToPath(new URL('./public/icon.png', import.meta.url));

export default defineConfig({
  plugins: [copyAppIcon(), react(), contentSecurityPolicy()],
  resolve: {
    alias: {
      '@app/shared': fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)),
    },
  },
  server: {
    strictPort: false,
  },
});

function copyAppIcon(): Plugin {
  return {
    name: 'doccipher-copy-app-icon',
    buildStart() {
      syncAppIcon();
    },
    configureServer() {
      syncAppIcon();
    },
  };
}

function syncAppIcon(): void {
  mkdirSync(dirname(appIconPublic), { recursive: true });
  copyFileSync(appIconSource, appIconPublic);
}

function contentSecurityPolicy(): Plugin {
  return {
    name: 'doccipher-csp',
    transformIndexHtml(_, context) {
      const dev = context.server !== undefined;
      const policy = dev
        ? "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' ws: http://localhost:* http://127.0.0.1:*; object-src 'none'; base-uri 'self'"
        : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'";

      return [
        {
          tag: 'meta',
          attrs: {
            'http-equiv': 'Content-Security-Policy',
            content: policy,
          },
          injectTo: 'head-prepend',
        },
      ];
    },
  };
}
