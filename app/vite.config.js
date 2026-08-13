import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Sparfuchs',
        short_name: 'Sparfuchs',
        description: 'Alle Prospekt-Angebote deiner Discounter an einem Ort',
        lang: 'de',
        theme_color: '#1C1B1A',
        background_color: '#1C1B1A',
        display: 'standalone',
        start_url: '/',
      },
      // TODO: App-Icons (192x192, 512x512) ergänzen, sobald ein Icon-Design steht.
      workbox: {
        // Angebote sollen offline sichtbar bleiben, nicht nur die App-Shell.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'firestore-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
        ],
      },
    }),
  ],
})
