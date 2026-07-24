import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
 plugins:[react()],
 base:process.env.VITE_BASE_PATH || '/',
 build:{
  rollupOptions:{
   output:{
    entryFileNames:'assets/app.js',
    chunkFileNames:'assets/[name].js',
    assetFileNames:'assets/[name][extname]'
   }
  }
 }
});
