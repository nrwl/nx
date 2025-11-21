import { existsSync, readFileSync, writeFileSync } from 'fs';

export function writeViteConfig(
  appName: string,
  isStandalone: boolean,
  isJs: boolean
) {
  let port = 3000;

  // Use PORT from .env file if it exists in project.
  if (existsSync(`../.env`)) {
    const envFile = readFileSync(`../.env`).toString();
    const result = envFile.match(/\bport=(?<port>\d{4})/i);
    const portCandidate = Number(result?.groups?.port);
    if (!isNaN(portCandidate)) {
      port = portCandidate;
    }
  }

  writeFileSync(
    isStandalone ? 'vite.config.mjs' : `apps/${appName}/vite.config.mjs`,
    `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import replace from '@rollup/plugin-replace';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

// Match CRA's environment variables.
// TODO: Replace these with VITE_ prefixed environment variables, and using import.meta.env.VITE_* instead of process.env.REACT_APP_*.
const craEnvVarRegex = /^REACT_APP/i;
const craEnvVars = Object.keys(process.env)
  .filter((key) => craEnvVarRegex.test(key))
  .reduce((env, key) => {
    env[\`process.env.\${key}\`] = JSON.stringify(process.env[key]);
    return env;
  }, {});

// https://vite.dev/config/
export default defineConfig({
  build: {
    outDir: ${
      isStandalone ? `'./dist/${appName}'` : `'../../dist/apps/${appName}'`
    }
  },
  server: {
    port: ${port},
    open: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: 'src/setupTests.${isJs ? 'js' : 'ts'}',
    css: true,
  },
  plugins: [
    react(),
    replace({ values: craEnvVars, preventAssignment: true }),
    nxViteTsPaths(),
  ],
});
`
  );
}
