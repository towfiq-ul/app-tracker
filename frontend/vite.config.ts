import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  // GitHub Pages project-page path (must match the GitHub repo name); adjust if the repo
  // is renamed or moved to a user/org page.
  base: command === "build" ? "/app-tracker/" : "/",
  server: {
    port: 3012,
    strictPort: true,
  },
}))
