import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// A separate build for the drift playground, so the main app and Storybook builds are untouched.
// base './' makes every asset path relative, so the output works from any folder (GitHub Pages sub-paths, iframes).
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'playground-dist',
    emptyOutDir: true,
    rollupOptions: { input: { playground: 'playground/index.html' } },
  },
})
