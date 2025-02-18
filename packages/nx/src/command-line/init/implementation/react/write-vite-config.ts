import { existsSync, readFileSync, writeFileSync } from 'fs';

export function writeViteConfig(
  appName: string,
  isStandalone: boolean,
  isJs: boolean
) {
  let port = 4200;

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
    isStandalone ? 'vite.config.js' : `apps/${appName}/vite.config.js`,
    `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { default as replace } from '@rollup/plugin-replace';

// Match CRA's environment variables.
// TODO: Replace these with VITE_ prefixed environment variables, and using import.meta.env.VITE_* instead of process.env.REACT_APP_*.
const craEnvVarRegex = /^REACT_APP/i;
const craEnvVars = Object.keys(process.env)
  .filter((key) => craEnvVarRegex.test(key))
  .reduce((env, key) => {
    env[\`process.env.\${key}\`] = JSON.stringify(process.env[key]);
    return env;
  }, {});

// https://vitejs.dev/config/
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
  plugins: [react(), replace(craEnvVars)],
});
`
  );
}
