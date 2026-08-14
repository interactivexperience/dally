import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Deployment-Ziel ist GitHub Pages als Projekt-Seite (nicht <user>.github.io),
// die App liegt also unter /dally/ statt am Domain-Root - base/start_url/scope
// müssen das widerspiegeln, sonst brechen Assets + Client-Routing nach dem Deploy.
const BASE_PATH = '/dally/'

export default defineConfig({
  base: BASE_PATH,
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
        start_url: BASE_PATH,
        scope: BASE_PATH,
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
