import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://zenfeed.app',
  vite: {
    plugins: [tailwindcss()]
  }
});
