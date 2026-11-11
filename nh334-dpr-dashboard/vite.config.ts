import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { excelUploadPlugin } from './vite-excel-plugin.ts'

// https://vite.dev/config/
export default defineConfig({
  server: {
    allowedHosts: true,
    host: '0.0.0.0',
  },
  plugins: [
    react(),
    tailwindcss(),
    excelUploadPlugin(),
  ],
})
