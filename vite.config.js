import { defineConfig, loadEnv } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/#using-environment-variables-in-config
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    // Relative asset paths, so dist/ works from a domain root, a subpath
    // like GitHub Pages' /pong/, and a double-clicked file:// URL alike.
    base: './',
    plugins: [
      tailwindcss(),
    ],
    server: {
      // Not PORT: loadEnv's empty prefix merges all of process.env over .env,
      // and an ambient PORT is far too common to let it win silently.
      port: env.PONG_PORT ? Number(env.PONG_PORT) : 3000,
      // A taken port is an error, not a silent hop to the next one.
      strictPort: true,
    },
  }
})
