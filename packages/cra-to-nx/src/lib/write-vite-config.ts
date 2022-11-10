import * as fs from 'fs';

export function writeViteConfig(appName: string) {
  fs.writeFileSync(
    `apps/${appName}/vite.config.js`,
    `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    outDir: '../../dist/apps/${appName}'
  },
  server: {
    open: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: 'src/setupTests.js',
    css: true,
  },
  plugins: [react()],
});
`
  );
}
