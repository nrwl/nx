import { stripIndents } from '@nx/devkit';
import { execSync } from 'child_process';
import {
  checkFilesExist,
  cleanupProject,
  getPackageManagerCommand,
  getSelectedPackageManager,
  newProject,
  runCLI,
  runCLIAsync,
  runCommand,
  runCommandUntil,
  promisifiedTreeKill,
  tmpProjPath,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e-utils';

function configureAsEsm(projectPath: string, isLibrary = false) {
  // Update project.json to configure build target for ESM
  const projectJsonPath = `${projectPath}/project.json`;
  updateJson(projectJsonPath, (config) => {
    if (config.targets?.build?.options) {
      // Configure build executor to output ESM format
      config.targets.build.options.format = ['esm'];
    }
    return config;
  });

  // Also update TypeScript config to match ESM
  const tsconfigPath = isLibrary
    ? `${projectPath}/tsconfig.lib.json`
    : `${projectPath}/tsconfig.app.json`;

  updateJson(tsconfigPath, (config) => {
    if (config.compilerOptions) {
      config.compilerOptions.module = 'ES2022';
      config.compilerOptions.target = 'ES2022';
    }
    return config;
  });
}

describe('JS ESM/CJS Support', () => {
  const selectedPm = getSelectedPackageManager();
  beforeAll(() => {
    newProject({
      packages: ['@nx/node', '@nx/js', '@nx/esbuild'],
      packageManager: selectedPm === 'npm' ? 'pnpm' : selectedPm,
    });
  });

  afterAll(() => {
    cleanupProject();
  });

  describe('CommonJS Applications', () => {
    it('should run CommonJS app with CommonJS dependencies', async () => {
      const nodeapp = uniq('nodeapp-cjs');
      runCLI(
        `generate @nx/node:app apps/${nodeapp} --linter=eslint --unitTestRunner=jest`
      );

      updateFile(
        `apps/${nodeapp}/src/main.ts`,
        stripIndents`
          const fs = require('fs');
          console.log('CommonJS app running');
          console.log('fs module type:', typeof fs.readFileSync);
        `
      );

      await runCLIAsync(`build ${nodeapp}`);
      checkFilesExist(`dist/apps/${nodeapp}/main.js`);

      const result = execSync(`node dist/apps/${nodeapp}/main.js`, {
        cwd: tmpProjPath(),
      }).toString();
      expect(result).toContain('CommonJS app running');
      expect(result).toContain('fs module type: function');
    }, 600000);

    it('should run CommonJS app with ESM-only dependencies', async () => {
      const nodeapp = uniq('nodeapp-cjs-esm');
      runCLI(
        `generate @nx/node:app apps/${nodeapp} --linter=eslint --unitTestRunner=jest`
      );

      // Install node-fetch (ESM-only package)
      const pmc = getPackageManagerCommand();
      runCommand(`${pmc.addDev} node-fetch@3.3.0`);

      // Create a CommonJS app that imports ESM-only package
      updateFile(
        `apps/${nodeapp}/src/main.ts`,
        stripIndents`
          async function main() {
            console.log('CommonJS app with ESM dependency starting');
            try {
              const { default: fetch } = await import('node-fetch');
              console.log('Successfully imported node-fetch');
              console.log('fetch type:', typeof fetch);
            } catch (error) {
              console.error('Failed to import node-fetch:', error.message);
            }
          }
          main();
        `
      );

      await runCLIAsync(`build ${nodeapp}`);
      checkFilesExist(`dist/apps/${nodeapp}/main.js`);

      const result = execSync(`node dist/apps/${nodeapp}/main.js`, {
        cwd: tmpProjPath(),
      }).toString();
      expect(result).toContain('CommonJS app with ESM dependency starting');
      expect(result).toContain('Successfully imported node-fetch');
      expect(result).toContain('fetch type: function');
    }, 600000);
  });

  describe('ESM Applications', () => {
    it('should run ESM app with ESM dependencies', async () => {
      const nodeapp = uniq('nodeapp-esm');
      runCLI(
        `generate @nx/node:app apps/${nodeapp} --linter=eslint --unitTestRunner=jest`
      );

      configureAsEsm(`apps/${nodeapp}`);

      // Install node-fetch (ESM-only package)
      const pmc = getPackageManagerCommand();
      runCommand(`${pmc.addDev} node-fetch@3.3.0`);

      updateFile(
        `apps/${nodeapp}/src/main.ts`,
        stripIndents`
          import fetch from 'node-fetch';
          import { readFileSync } from 'fs';
          
          console.log('ESM app running');
          console.log('fetch type:', typeof fetch);
          console.log('readFileSync type:', typeof readFileSync);
        `
      );

      await runCLIAsync(`build ${nodeapp}`);
      checkFilesExist(`dist/apps/${nodeapp}/main.js`);

      const result = execSync(`node dist/apps/${nodeapp}/main.js`, {
        cwd: tmpProjPath(),
      }).toString();
      expect(result).toContain('ESM app running');
      expect(result).toContain('fetch type: function');
      expect(result).toContain('readFileSync type: function');
    }, 600000);

    it('should run ESM app with normal .js output', async () => {
      const nodeapp = uniq('nodeapp-esm-js');
      runCLI(
        `generate @nx/node:app apps/${nodeapp} --linter=eslint --unitTestRunner=jest`
      );

      configureAsEsm(`apps/${nodeapp}`);

      updateFile(
        `apps/${nodeapp}/src/main.ts`,
        stripIndents`
          import { readFileSync } from 'fs';
          console.log('ESM app with .js output running');
          console.log('readFileSync type:', typeof readFileSync);
        `
      );

      await runCLIAsync(`build ${nodeapp}`);
      checkFilesExist(`dist/apps/${nodeapp}/main.js`);

      const result = execSync(`node dist/apps/${nodeapp}/main.js`, {
        cwd: tmpProjPath(),
      }).toString();
      expect(result).toContain('ESM app with .js output running');
      expect(result).toContain('readFileSync type: function');
    }, 600000);

    it('should run ESM app by detecting TypeScript module settings', async () => {
      const nodeapp = uniq('nodeapp-esm-ts');
      runCLI(
        `generate @nx/node:app apps/${nodeapp} --linter=eslint --unitTestRunner=jest`
      );

      updateJson(`apps/${nodeapp}/tsconfig.app.json`, (config) => {
        config.compilerOptions.module = 'ES2022';
        config.compilerOptions.target = 'ES2022';
        return config;
      });

      updateFile(
        `apps/${nodeapp}/src/main.ts`,
        stripIndents`
          import { readFileSync } from 'fs';
          console.log('ESM app detected via TypeScript config');
          console.log('readFileSync type:', typeof readFileSync);
        `
      );

      await runCLIAsync(`build ${nodeapp}`);
      checkFilesExist(`dist/apps/${nodeapp}/main.js`);

      const result = execSync(`node dist/apps/${nodeapp}/main.js`, {
        cwd: tmpProjPath(),
      }).toString();
      expect(result).toContain('ESM app detected via TypeScript config');
      expect(result).toContain('readFileSync type: function');
    }, 600000);
  });

  describe('Mixed Module Applications', () => {
    it('should run mixed app with workspace libraries', async () => {
      const nodeapp = uniq('nodeapp-mixed');
      const cjsLib = uniq('cjslib');
      const esmLib = uniq('esmlib');

      runCLI(
        `generate @nx/node:app apps/${nodeapp} --linter=eslint --unitTestRunner=jest`
      );
      runCLI(
        `generate @nx/js:lib libs/${cjsLib} --buildable --bundler=esbuild`
      );
      runCLI(
        `generate @nx/js:lib libs/${esmLib} --buildable --bundler=esbuild`
      );

      // Set up CJS library
      updateFile(
        `libs/${cjsLib}/src/lib/${cjsLib}.ts`,
        stripIndents`
          export function getCjsMessage() {
            return 'Message from CJS library';
          }
        `
      );

      configureAsEsm(`libs/${esmLib}`, true);

      updateFile(
        `libs/${esmLib}/src/lib/${esmLib}.ts`,
        stripIndents`
          export function getEsmMessage() {
            return 'Message from ESM library';
          }
        `
      );

      updateFile(
        `apps/${nodeapp}/src/main.ts`,
        stripIndents`
          import { getCjsMessage } from '@proj/${cjsLib}';
          import { getEsmMessage } from '@proj/${esmLib}';
          
          console.log('Mixed app running');
          console.log('CJS lib:', getCjsMessage());
          console.log('ESM lib:', getEsmMessage());
        `
      );

      await runCLIAsync(`build ${cjsLib}`);
      await runCLIAsync(`build ${esmLib}`);
      await runCLIAsync(`build ${nodeapp}`);

      checkFilesExist(`dist/apps/${nodeapp}/main.js`);
      checkFilesExist(`dist/libs/${cjsLib}/index.cjs`);
      checkFilesExist(`dist/libs/${esmLib}/index.js`);

      const result = execSync(`node dist/apps/${nodeapp}/main.js`, {
        cwd: tmpProjPath(),
      }).toString();
      expect(result).toContain('Mixed app running');
      expect(result).toContain('CJS lib: Message from CJS library');
      expect(result).toContain('ESM lib: Message from ESM library');
    }, 600000);
  });

  describe('Node Executor ESM/CJS Detection', () => {
    it('should serve CommonJS apps', async () => {
      const nodeapp = uniq('nodeapp-serve-cjs');
      runCLI(
        `generate @nx/node:app apps/${nodeapp} --linter=eslint --unitTestRunner=jest`
      );

      updateFile(
        `apps/${nodeapp}/src/main.ts`,
        stripIndents`
          const http = require('http');
          const server = http.createServer((req, res) => {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('CommonJS server running');
          });
          server.listen(3000, () => {
            console.log('Server running on port 3000');
          });
        `
      );

      await runCLIAsync(`build ${nodeapp}`);
      checkFilesExist(`dist/apps/${nodeapp}/main.js`);

      // Test that the built app can run (start server and capture initial output)
      const result = execSync(
        `node dist/apps/${nodeapp}/main.js & PID=$!; sleep 1; kill $PID 2>/dev/null || true; wait $PID 2>/dev/null || true`,
        {
          cwd: tmpProjPath(),
          timeout: 5000,
        }
      ).toString();
      expect(result).toContain('Server running on port 3000');
    }, 600000);

    it('should serve ESM apps', async () => {
      const nodeapp = uniq('nodeapp-serve-esm');
      runCLI(
        `generate @nx/node:app apps/${nodeapp} --linter=eslint --unitTestRunner=jest`
      );

      // Configure build target to output ESM format
      configureAsEsm(`apps/${nodeapp}`);

      // Create a simple ESM server
      updateFile(
        `apps/${nodeapp}/src/main.ts`,
        stripIndents`
          import { createServer } from 'http';
          const server = createServer((req, res) => {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('ESM server running');
          });
          server.listen(3001, () => {
            console.log('ESM server running on port 3001');
          });
        `
      );

      runCLI(`build ${nodeapp}`);
      checkFilesExist(`dist/apps/${nodeapp}/main.js`);

      const serveProcess = await runCommandUntil(`serve ${nodeapp}`, (output) =>
        output.includes('ESM server running on port 3001')
      );

      await promisifiedTreeKill(serveProcess.pid, 'SIGKILL');
    }, 600000);

    it('should serve CommonJS app', async () => {
      const nodeapp = uniq('nodeapp-serve-cjs-live');
      runCLI(
        `generate @nx/node:app apps/${nodeapp} --linter=eslint --unitTestRunner=jest`
      );

      // Create a simple server that logs a message we can detect
      updateFile(
        `apps/${nodeapp}/src/main.ts`,
        stripIndents`
          const http = require('http');
          console.log('CommonJS server starting');
          const server = http.createServer((req, res) => {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('Hello from CommonJS');
          });
          server.listen(3100, () => {
            console.log('CommonJS server ready on port 3100');
          });
        `
      );

      const serveProcess = await runCommandUntil(
        `serve ${nodeapp}`,
        (output) => {
          return output.includes('CommonJS server ready on port 3100');
        }
      );

      await promisifiedTreeKill(serveProcess.pid, 'SIGKILL');
    }, 600000);

    it('should serve ESM app', async () => {
      const nodeapp = uniq('nodeapp-serve-esm-live');
      runCLI(
        `generate @nx/node:app apps/${nodeapp} --linter=eslint --unitTestRunner=jest`
      );

      // Configure build target to output ESM format
      configureAsEsm(`apps/${nodeapp}`);

      // Create a simple ESM server that logs a message we can detect
      updateFile(
        `apps/${nodeapp}/src/main.ts`,
        stripIndents`
          import { createServer } from 'http';
          console.log('ESM server starting');
          const server = createServer((req, res) => {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('Hello from ESM');
          });
          server.listen(3101, () => {
            console.log('ESM server ready on port 3101');
          });
        `
      );

      const serveProcess = await runCommandUntil(
        `serve ${nodeapp}`,
        (output) => {
          return output.includes('ESM server ready on port 3101');
        }
      );

      await promisifiedTreeKill(serveProcess.pid, 'SIGKILL');
    }, 600000);
  });
});
