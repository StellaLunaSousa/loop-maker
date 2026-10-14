import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Relative base so the build works on GitHub Pages (/loop-maker/) or any host.
export default defineConfig({
  base: './',
  plugins: [react()],
})
