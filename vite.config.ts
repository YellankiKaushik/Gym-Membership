import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { deploymentConfig } from './scripts/deployment-config.mjs'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const { apiUrl, environment, lookupMode } = deploymentConfig(env);
  return {
    base: '/',
    // Only the explicit public configuration below is exposed to client code.
    envPrefix: [],
    plugins: [react()],
    define: { __GYM_PUBLIC_CONFIG__: JSON.stringify({
      apiUrl, environment, lookupMode, name: env.VITE_GYM_NAME, tagline: env.VITE_GYM_TAGLINE,
      description: env.VITE_GYM_DESCRIPTION, trainerName: env.VITE_TRAINER_NAME,
      trainerTitle: env.VITE_TRAINER_TITLE, address: env.VITE_GYM_ADDRESS,
      mapUrl: env.VITE_GYM_MAP_URL, logoUrl: env.VITE_GYM_LOGO_URL,
      galleryImages: env.VITE_GALLERY_IMAGES, contactPhone: env.VITE_CONTACT_PHONE,
      contactEmail: env.VITE_CONTACT_EMAIL,
    }) },
  };
});
