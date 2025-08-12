import { stripIndents } from '@angular-devkit/core/src/utils/literals';
import {
  checkFilesExist,
  cleanupProject,
  getPackageManagerCommand,
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
  detectPackageManager,
} from '@nx/e2e-utils';
import { execSync } from 'child_process';

function configureAsEsm(projectPath: string) {
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
  const tsconfigPath = `${projectPath}/tsconfig.app.json`;
  updateJson(tsconfigPath, (config) => {
    if (config.compilerOptions) {
      config.compilerOptions.module = 'ES2022';
      config.compilerOptions.target = 'ES2022';
    }
    return config;
  });
}

const selectedPm = detectPackageManager();

describe('Node.js Framework ESM Support', () => {
  beforeAll(() => {
    newProject({
      packages: ['@nx/node'],
      packageManager: selectedPm === 'npm' ? 'pnpm' : selectedPm,
    });
  });

  afterAll(() => {
    cleanupProject();
  });

  describe('Express Framework with ESM', () => {
    it('should build and run Express app with ESM modules', async () => {
      const expressApp = uniq('express-esm');
      runCLI(
        `generate @nx/node:app apps/${expressApp} --framework=express --linter=eslint --unitTestRunner=jest`
      );

      // Install node-fetch (ESM-only package)
      const pmc = getPackageManagerCommand();
      runCommand(`${pmc.addDev} node-fetch@3.3.0`);

      // Configure as ESM
      configureAsEsm(`apps/${expressApp}`);

      // Update the Express app to use ESM imports
      updateFile(
        `apps/${expressApp}/src/main.ts`,
        stripIndents`
          import express from 'express';
          import fetch from 'node-fetch';
          
          const app = express();
          
          app.get('/api', (req, res) => {
            res.json({ 
              message: 'Welcome to ${expressApp}!',
              framework: 'express',
              fetch_available: typeof fetch === 'function'
            });
          });
          
          console.log('Express ESM app starting');
          console.log('fetch type:', typeof fetch);
          
          const port = process.env.PORT || 3000;
          const server = app.listen(port, () => {
            console.log('Express ESM server ready on port ' + port);
          });
          server.on('error', console.error);
        `
      );

      await runCLIAsync(`build ${expressApp}`);
      checkFilesExist(`dist/apps/${expressApp}/main.js`);

      const result = execSync(
        `node dist/apps/${expressApp}/main.js & PID=$!; sleep 1; kill $PID 2>/dev/null || true; wait $PID 2>/dev/null || true`,
        {
          cwd: tmpProjPath(),
          timeout: 10000,
        }
      ).toString();
      expect(result).toContain('Express ESM app starting');
      expect(result).toContain('Express ESM server ready on port');
      expect(result).toContain('fetch type: function');
    }, 600000);

    it('should serve Express app with ESM modules', async () => {
      const expressApp = uniq('express-esm-serve');
      runCLI(
        `generate @nx/node:app apps/${expressApp} --framework=express --linter=eslint --unitTestRunner=jest`
      );

      // Install node-fetch (ESM-only package)
      const pmc = getPackageManagerCommand();
      runCommand(`${pmc.addDev} node-fetch@3.3.0`);

      // Configure as ESM
      configureAsEsm(`apps/${expressApp}`);

      // Create Express server with ESM imports
      updateFile(
        `apps/${expressApp}/src/main.ts`,
        stripIndents`
          import express from 'express';
          import fetch from 'node-fetch';
          
          const app = express();
          
          console.log('Express ESM serve starting');
          console.log('fetch type:', typeof fetch);
          
          app.get('/api', (req, res) => {
            res.json({ message: 'Express ESM serve working' });
          });
          
          const port = process.env.PORT || 3000;
          const server = app.listen(port, () => {
            console.log('Express ESM serve ready on port ' + port);
          });
          server.on('error', console.error);
        `
      );

      const serveProcess = await runCommandUntil(
        `serve ${expressApp}`,
        (output) => {
          return output.includes('Express ESM serve ready on port');
        }
      );

      await promisifiedTreeKill(serveProcess.pid, 'SIGKILL');
    }, 600000);
  });

  describe('Fastify Framework with ESM', () => {
    it('should build and run Fastify app with ESM modules', async () => {
      const fastifyApp = uniq('fastify-esm');
      runCLI(
        `generate @nx/node:app apps/${fastifyApp} --framework=fastify --linter=eslint --unitTestRunner=jest`
      );

      // Install node-fetch (ESM-only package)
      const pmc = getPackageManagerCommand();
      runCommand(`${pmc.addDev} node-fetch@3.3.0`);

      // Configure as ESM
      configureAsEsm(`apps/${fastifyApp}`);

      // Update the Fastify app to use ESM imports
      updateFile(
        `apps/${fastifyApp}/src/main.ts`,
        stripIndents`
          import Fastify from 'fastify';
          import fetch from 'node-fetch';
          
          const fastify = Fastify({
            logger: false
          });
          
          fastify.get('/api', async (request, reply) => {
            return { 
              message: 'Welcome to ${fastifyApp}!',
              framework: 'fastify',
              fetch_available: typeof fetch === 'function'
            };
          });
          
          console.log('Fastify ESM app starting');
          console.log('fetch type:', typeof fetch);
          
          const start = async () => {
            try {
              const port = +(process.env.PORT || 3000);
              await fastify.listen({ port });
              console.log('Fastify ESM server ready on port ' + port);
            } catch (err) {
              fastify.log.error(err);
              process.exit(1);
            }
          };
          start();
        `
      );

      await runCLIAsync(`build ${fastifyApp}`);
      checkFilesExist(`dist/apps/${fastifyApp}/main.js`);

      const result = execSync(
        `node dist/apps/${fastifyApp}/main.js & PID=$!; sleep 1; kill $PID 2>/dev/null || true; wait $PID 2>/dev/null || true`,
        {
          cwd: tmpProjPath(),
          timeout: 10000,
        }
      ).toString();
      expect(result).toContain('Fastify ESM app starting');
      expect(result).toContain('Fastify ESM server ready on port');
      expect(result).toContain('fetch type: function');
    }, 600000);

    it('should serve Fastify app with ESM modules', async () => {
      const fastifyApp = uniq('fastify-esm-serve');
      runCLI(
        `generate @nx/node:app apps/${fastifyApp} --framework=fastify --linter=eslint --unitTestRunner=jest`
      );

      // Install node-fetch (ESM-only package)
      const pmc = getPackageManagerCommand();
      runCommand(`${pmc.addDev} node-fetch@3.3.0`);

      // Configure as ESM
      configureAsEsm(`apps/${fastifyApp}`);

      // Create Fastify server with ESM imports
      updateFile(
        `apps/${fastifyApp}/src/main.ts`,
        stripIndents`
          import Fastify from 'fastify';
          import fetch from 'node-fetch';
          
          const fastify = Fastify({ logger: false });
          
          console.log('Fastify ESM serve starting');
          console.log('fetch type:', typeof fetch);
          
          fastify.get('/api', async (request, reply) => {
            return { message: 'Fastify ESM serve working' };
          });
          
          const start = async () => {
            try {
              const port = +(process.env.PORT || 3000);
              await fastify.listen({ port });
              console.log('Fastify ESM serve ready on port ' + port);
            } catch (err) {
              process.exit(1);
            }
          };
          start();
        `
      );

      const serveProcess = await runCommandUntil(
        `serve ${fastifyApp}`,
        (output) => {
          return output.includes('Fastify ESM serve ready on port');
        }
      );

      await promisifiedTreeKill(serveProcess.pid, 'SIGKILL');
    }, 600000);
  });

  describe('Koa Framework with ESM', () => {
    it('should build and run Koa app with ESM modules', async () => {
      const koaApp = uniq('koa-esm');
      runCLI(
        `generate @nx/node:app apps/${koaApp} --framework=koa --linter=eslint --unitTestRunner=jest`
      );

      // Install node-fetch (ESM-only package) and koa router
      const pmc = getPackageManagerCommand();
      runCommand(
        `${pmc.addDev} node-fetch@3.3.0 @koa/router @types/koa__router`
      );

      // Configure as ESM
      configureAsEsm(`apps/${koaApp}`);

      // Update the Koa app to use ESM imports
      updateFile(
        `apps/${koaApp}/src/main.ts`,
        stripIndents`
          import Koa from 'koa';
          import Router from '@koa/router';
          import fetch from 'node-fetch';
          
          const app = new Koa();
          const router = new Router();
          
          router.get('/api', (ctx) => {
            ctx.body = { 
              message: 'Welcome to ${koaApp}!',
              framework: 'koa',
              fetch_available: typeof fetch === 'function'
            };
          });
          
          app.use(router.routes()).use(router.allowedMethods());
          
          console.log('Koa ESM app starting');
          console.log('fetch type:', typeof fetch);
          
          const port = +(process.env.PORT || 3000);
          const server = app.listen(port, () => {
            console.log('Koa ESM server ready on port ' + port);
          });
          server.on('error', console.error);
        `
      );

      await runCLIAsync(`build ${koaApp}`);
      checkFilesExist(`dist/apps/${koaApp}/main.js`);

      const result = execSync(
        `node dist/apps/${koaApp}/main.js & PID=$!; sleep 1; kill $PID 2>/dev/null || true; wait $PID 2>/dev/null || true`,
        {
          cwd: tmpProjPath(),
          timeout: 10000,
        }
      ).toString();
      expect(result).toContain('Koa ESM app starting');
      expect(result).toContain('Koa ESM server ready on port');
      expect(result).toContain('fetch type: function');
    }, 600000);

    it('should serve Koa app with ESM modules', async () => {
      const koaApp = uniq('koa-esm-serve');
      runCLI(
        `generate @nx/node:app apps/${koaApp} --framework=koa --linter=eslint --unitTestRunner=jest`
      );

      // Install node-fetch (ESM-only package) and koa router
      const pmc = getPackageManagerCommand();
      runCommand(
        `${pmc.addDev} node-fetch@3.3.0 @koa/router @types/koa__router`
      );

      // Configure as ESM
      configureAsEsm(`apps/${koaApp}`);

      // Create Koa server with ESM imports
      updateFile(
        `apps/${koaApp}/src/main.ts`,
        stripIndents`
          import Koa from 'koa';
          import Router from '@koa/router';
          import fetch from 'node-fetch';
          
          const app = new Koa();
          const router = new Router();
          
          console.log('Koa ESM serve starting');
          console.log('fetch type:', typeof fetch);
          
          router.get('/api', (ctx) => {
            ctx.body = { message: 'Koa ESM serve working' };
          });
          
          app.use(router.routes()).use(router.allowedMethods());
          
          const port = +(process.env.PORT || 3000);
          const server = app.listen(port, () => {
            console.log('Koa ESM serve ready on port ' + port);
          });
          server.on('error', console.error);
        `
      );

      const serveProcess = await runCommandUntil(
        `serve ${koaApp}`,
        (output) => {
          return output.includes('Koa ESM serve ready on port');
        }
      );

      await promisifiedTreeKill(serveProcess.pid, 'SIGKILL');
    }, 600000);
  });

  describe('Nest Framework with ESM', () => {
    it('should build and run Nest app with ESM modules', async () => {
      const nestApp = uniq('nest-esm');
      runCLI(
        `generate @nx/node:app apps/${nestApp} --framework=nest --linter=eslint --unitTestRunner=jest`
      );

      // Install node-fetch (ESM-only package)
      const pmc = getPackageManagerCommand();
      runCommand(`${pmc.addDev} node-fetch@3.3.0`);

      // Configure as ESM
      configureAsEsm(`apps/${nestApp}`);

      // Update the Nest app to use ESM imports
      updateFile(
        `apps/${nestApp}/src/main.ts`,
        stripIndents`
          import { NestFactory } from '@nestjs/core';
          import { AppModule } from './app/app.module';
          
          async function bootstrap() {
            console.log('Nest ESM app starting');
            
            try {
              // Test ESM-only package import
              const { default: fetch } = await import('node-fetch');
              console.log('fetch type:', typeof fetch);
            } catch (error) {
              console.error('Failed to import node-fetch:', error.message);
            }
            
            const app = await NestFactory.create(AppModule);
            const globalPrefix = 'api';
            app.setGlobalPrefix(globalPrefix);
            const port = process.env.PORT || 3000;
            await app.listen(port);
            console.log('Nest ESM server ready on port ' + port);
          }
          
          bootstrap();
        `
      );

      await runCLIAsync(`build ${nestApp}`);
      checkFilesExist(`dist/apps/${nestApp}/main.js`);

      const result = execSync(
        `node dist/apps/${nestApp}/main.js & PID=$!; sleep 1; kill $PID 2>/dev/null || true; wait $PID 2>/dev/null || true`,
        {
          cwd: tmpProjPath(),
          timeout: 10000,
        }
      ).toString();
      expect(result).toContain('Nest ESM app starting');
      expect(result).toContain('Nest ESM server ready on port');
      expect(result).toContain('fetch type: function');
    }, 600000);

    it('should serve Nest app with ESM modules', async () => {
      const nestApp = uniq('nest-esm-serve');
      runCLI(
        `generate @nx/node:app apps/${nestApp} --framework=nest --linter=eslint --unitTestRunner=jest`
      );

      // Install node-fetch (ESM-only package) and ajv@8 to fix dependency conflicts
      const pmc = getPackageManagerCommand();
      runCommand(`${pmc.addDev} node-fetch@3.3.0`);
      runCommand(`${pmc.addDev} ajv@^8.17.1`);

      // Configure as ESM
      configureAsEsm(`apps/${nestApp}`);

      // Create Nest server with ESM imports
      updateFile(
        `apps/${nestApp}/src/main.ts`,
        stripIndents`
          import { NestFactory } from '@nestjs/core';
          import { AppModule } from './app/app.module';
          
          async function bootstrap() {
            console.log('Nest ESM serve starting');
            
            try {
              const { default: fetch } = await import('node-fetch');
              console.log('fetch type:', typeof fetch);
            } catch (error) {
              console.error('Failed to import node-fetch:', error.message);
            }
            
            const app = await NestFactory.create(AppModule);
            const globalPrefix = 'api';
            app.setGlobalPrefix(globalPrefix);
            const port = process.env.PORT || 3000;
            await app.listen(port);
            console.log('Nest ESM serve ready on port ' + port);
          }
          
          bootstrap();
        `
      );

      const serveProcess = await runCommandUntil(
        `serve ${nestApp}`,
        (output) => {
          return output.includes('Nest ESM serve ready on port');
        }
      );

      await promisifiedTreeKill(serveProcess.pid, 'SIGKILL');
    }, 600000);
  });

  describe('Mixed Imports across Node.js Frameworks', () => {
    it('should handle CommonJS and ESM packages together', async () => {
      const nodeApp = uniq('node-mixed-imports');
      runCLI(
        `generate @nx/node:app apps/${nodeApp} --framework=express --linter=eslint --unitTestRunner=jest`
      );

      // Install packages with different module formats
      const pmc = getPackageManagerCommand();
      runCommand(
        `${pmc.addDev} express @types/express node-fetch@3.3.0 lodash @types/lodash`
      );

      // Create an Express app that uses both CommonJS (lodash) and ESM (node-fetch) packages
      updateFile(
        `apps/${nodeApp}/src/main.ts`,
        stripIndents`
          import express from 'express';
          import * as lodash from 'lodash';
          
          const app = express();
          
          app.get('/api', async (req, res) => {
            try {
              // Import ESM-only package dynamically
              const { default: fetch } = await import('node-fetch');
              
              // Use CommonJS package (lodash)
              const data = lodash.pick({ a: 1, b: 2, c: 3 }, ['a', 'b']);
              
              res.json({ 
                message: 'Welcome to ${nodeApp}!',
                data,
                fetch_available: typeof fetch === 'function',
                lodash_available: typeof lodash.pick === 'function'
              });
            } catch (error) {
              res.status(500).json({ error: error.message });
            }
          });
          
          console.log('Mixed imports Node.js app starting');
          console.log('lodash.pick type:', typeof lodash.pick);
          
          const port = process.env.PORT || 3000;
          const server = app.listen(port, () => {
            console.log('Mixed imports server ready on port ' + port);
          });
          server.on('error', console.error);
        `
      );

      await runCLIAsync(`build ${nodeApp}`);
      checkFilesExist(`dist/apps/${nodeApp}/main.js`);

      const result = execSync(
        `node dist/apps/${nodeApp}/main.js & PID=$!; sleep 1; kill $PID 2>/dev/null || true; wait $PID 2>/dev/null || true`,
        {
          cwd: tmpProjPath(),
          timeout: 10000,
        }
      ).toString();
      expect(result).toContain('Mixed imports Node.js app starting');
      expect(result).toContain('Mixed imports server ready on port');
      expect(result).toContain('lodash.pick type: function');
    }, 600000);
  });
});
