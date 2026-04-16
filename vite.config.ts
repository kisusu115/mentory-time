import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.json'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const resolvedManifest = {
    ...manifest,
    oauth2: {
      ...manifest.oauth2,
      client_id: env.VITE_GCAL_CLIENT_ID || manifest.oauth2.client_id,
    },
  }

  return {
    server: {
      cors: { origin: '*' },
      headers: { 'Access-Control-Allow-Origin': '*' },
    },
    plugins: [
      react(),
      crx({ manifest: resolvedManifest }),
    ],
  }
})
