import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const apiUrl = env.VITE_APPS_SCRIPT_URL || '';
  if (apiUrl && !/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(apiUrl)) {
    throw new Error('VITE_APPS_SCRIPT_URL must be a Google Apps Script HTTPS /exec URL without query parameters.');
  }
  return {
    base: '/',
    plugins: [react()],
    define: { __GYM_PUBLIC_CONFIG__: JSON.stringify({
      apiUrl, name: env.VITE_GYM_NAME, tagline: env.VITE_GYM_TAGLINE,
      description: env.VITE_GYM_DESCRIPTION, trainerName: env.VITE_TRAINER_NAME,
      trainerTitle: env.VITE_TRAINER_TITLE, address: env.VITE_GYM_ADDRESS,
      mapUrl: env.VITE_GYM_MAP_URL, logoUrl: env.VITE_GYM_LOGO_URL,
      galleryImages: env.VITE_GALLERY_IMAGES, contactPhone: env.VITE_CONTACT_PHONE,
      contactEmail: env.VITE_CONTACT_EMAIL,
    }) },
  };
});
