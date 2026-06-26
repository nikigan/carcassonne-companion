import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // Served from the domain root (https://carcassonne.gankin.xyz/) on Cloudflare.
  base: '/',
  plugins: [react(), tailwindcss()],
})
