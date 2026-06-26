import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // Served from the domain root (https://carcassonne.gankin.xyz/) on Cloudflare.
  base: '/',
  plugins: [
    react(),
    tailwindcss(),
    cloudflare(),
    VitePWA({
      // 'prompt': never reload on our own — show a Refresh toast (UpdatePrompt).
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Carcassonne Companion',
        short_name: 'Carcassonne',
        description:
          "A web companion app for the board game Carcassonne to track each player's score.",
        lang: 'en',
        id: '/',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#1f2937',
        background_color: '#1f2937',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Android-only: let Chrome route in-scope `/r/<code>` links into the
        // installed PWA (gated by the user's "Open supported links" setting).
        // Ignored everywhere it isn't supported (including all of iOS).
        launch_handler: { client_mode: ['navigate-existing', 'auto'] },
        handle_links: 'preferred',
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        // SPA deep links resolve to index.html, EXCEPT the multiplayer API/WS route.
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
      },
      // Service worker stays off during `npm run dev`.
      devOptions: { enabled: false },
    }),
  ],
})
