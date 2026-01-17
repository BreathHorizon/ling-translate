import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import manifest from './src/manifest.json'
import path from 'path'
import zip from 'vite-plugin-zip-pack'

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
    zip({ outDir: 'release', outFileName: 'release.zip' }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    sourcemap: true
  }
})
