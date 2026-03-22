import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import fs from 'fs';

// Replaces __FIREBASE_*__ placeholders in firebase-messaging-sw.js at build time
function firebaseSwPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'firebase-sw-env',
    // Runs after the build writes files to dist/
    closeBundle() {
      const swPath = path.resolve(__dirname, 'dist/firebase-messaging-sw.js');
      if (!fs.existsSync(swPath)) return;

      let content = fs.readFileSync(swPath, 'utf-8');
      content = content
        .replace('self.__FIREBASE_API_KEY__', JSON.stringify(env.VITE_FIREBASE_API_KEY ?? ''))
        .replace('self.__FIREBASE_AUTH_DOMAIN__', JSON.stringify(env.VITE_FIREBASE_AUTH_DOMAIN ?? ''))
        .replace('self.__FIREBASE_PROJECT_ID__', JSON.stringify(env.VITE_FIREBASE_PROJECT_ID ?? ''))
        .replace('self.__FIREBASE_MESSAGING_SENDER_ID__', JSON.stringify(env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? ''))
        .replace('self.__FIREBASE_APP_ID__', JSON.stringify(env.VITE_FIREBASE_APP_ID ?? ''));
      fs.writeFileSync(swPath, content);
      console.log('✅ Firebase SW env vars injected');
    },
    // In dev mode, serve with replaced values on the fly
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url !== '/firebase-messaging-sw.js') { next(); return; }
        const swPath = path.resolve(__dirname, 'public/firebase-messaging-sw.js');
        let content = fs.readFileSync(swPath, 'utf-8');
        content = content
          .replace('self.__FIREBASE_API_KEY__', JSON.stringify(env.VITE_FIREBASE_API_KEY ?? ''))
          .replace('self.__FIREBASE_AUTH_DOMAIN__', JSON.stringify(env.VITE_FIREBASE_AUTH_DOMAIN ?? ''))
          .replace('self.__FIREBASE_PROJECT_ID__', JSON.stringify(env.VITE_FIREBASE_PROJECT_ID ?? ''))
          .replace('self.__FIREBASE_MESSAGING_SENDER_ID__', JSON.stringify(env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? ''))
          .replace('self.__FIREBASE_APP_ID__', JSON.stringify(env.VITE_FIREBASE_APP_ID ?? ''));
        res.setHeader('Content-Type', 'application/javascript');
        res.end(content);
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [
      react(),
      firebaseSwPlugin(env),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
        manifest: {
          name: 'UdhaariBook',
          short_name: 'UdhaariBook',
          description: 'Digital khata — track credit, send reminders, collect payments',
          theme_color: '#6366f1',
          background_color: '#ffffff',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/.*\/api\/customers/,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-customers',
                expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
                networkTimeoutSeconds: 5,
              },
            },
            {
              urlPattern: /^https:\/\/.*\/api\/transactions/,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-transactions',
                expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 },
                networkTimeoutSeconds: 5,
              },
            },
          ],
        },
      }),
    ],
    build: {
      // Raise warning threshold — 500kb is too strict for a full app
      chunkSizeWarningLimit: 800,
      rollupOptions: {
        output: {
          manualChunks: {
            // Core React runtime
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            // UI / charts (large)
            'vendor-charts': ['recharts'],
            // Date utilities
            'vendor-dates': ['date-fns'],
            // Firebase subpackages
            'vendor-firebase': ['firebase/app', 'firebase/messaging'],
            // PDF generation
            'vendor-pdf': ['jspdf'],
            // Forms + validation
            'vendor-forms': ['react-hook-form', 'zod', '@hookform/resolvers'],
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: true,
      port: 5173,
    },
  };
});
