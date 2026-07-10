import { defineConfig, loadEnv } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/#using-environment-variables-in-config
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    base: './',
    plugins: [
      tailwindcss(),
    ],
    server: {
      port: env.PONG_PORT ? Number(env.PONG_PORT) : 3000,
      // A taken port is an error, not a silent hop to the next one.
      strictPort: true,
    },
  }
})
