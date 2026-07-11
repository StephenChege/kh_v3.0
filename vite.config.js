import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// export default defineConfig({
//   plugins: [react()],
//   base: process.env.NODE_ENV === 'production' 
//     ? '/' 
//     : '/',
// })

export default defineConfig({
  plugins: [react()],
  base: '/kh_v3.0/',
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
