import { type CreateNodesContext, joinPathFragments } from '@nx/devkit';
import { createNodesV2 as createNodes } from './plugin';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';
import { loadViteDynamicImport } from '../utils/executor-utils';

jest.mock('../utils/executor-utils', () => ({
  loadViteDynamicImport: jest.fn().mockResolvedValue({
    resolveConfig: jest.fn().mockResolvedValue({}),
  }),
}));

describe('@nx/remix/plugin', () => {
  let createNodesFunction = createNodes[1];
  let context: CreateNodesContext;
  let cwd = process.cwd();

  describe('Remix Classic Compiler', () => {
    describe('root project', () => {
      const tempFs = new TempFs('test');

      beforeEach(() => {
        context = {
          nxJsonConfiguration: {
            targetDefaults: {
              build: {
                cache: false,
                inputs: ['foo', '^foo'],
              },
              dev: {
                command: 'npm run dev',
              },
              start: {
                command: 'npm run start',
              },
              typecheck: {
                command: 'tsc',
              },
            },
            namedInputs: {
              default: ['{projectRoot}/**/*'],
              production: ['!{projectRoot}/**/*.spec.ts'],
            },
          },
          workspaceRoot: tempFs.tempDir,
          configFiles: [],
        };
        tempFs.createFileSync(
          'package.json',
          JSON.stringify('{name: "my-app", type: "module"}')
        );
        tempFs.createFileSync(
          'remix.config.cjs',
          `/**
 * @type {import('@remix-run/dev').AppConfig}
 */
module.exports = {
  ignoredRouteFiles: ['**/.*'],
  watchPaths: () => require('@nx/remix').createWatchPaths(__dirname),
};
`
        );
        process.chdir(tempFs.tempDir);
      });

      afterEach(() => {
        jest.resetModules();
        tempFs.cleanup();
        process.chdir(cwd);
      });

      it('should create nodes', async () => {
        // ACT
        const nodes = await createNodesFunction(
          ['remix.config.cjs'],
          {
            buildTargetName: 'build',
            devTargetName: 'dev',
            startTargetName: 'start',
            typecheckTargetName: 'typecheck',
            staticServeTargetName: 'static-serve',
          },
          context
        );

        // ASSERT
        expect(nodes).toMatchSnapshot();
      });
    });

    describe('non-root project', () => {
      const tempFs = new TempFs('test');

      beforeEach(() => {
        context = {
          nxJsonConfiguration: {
            namedInputs: {
              default: ['{projectRoot}/**/*'],
              production: ['!{projectRoot}/**/*.spec.ts'],
            },
          },
          workspaceRoot: tempFs.tempDir,
          configFiles: [],
        };

        tempFs.createFileSync(
          'my-app/project.json',
          JSON.stringify({ name: 'my-app' })
        );

        tempFs.createFileSync(
          'my-app/remix.config.cjs',
          `/**
 * @type {import('@remix-run/dev').AppConfig}
 */
module.exports = {
  ignoredRouteFiles: ['**/.*'],
  watchPaths: () => require('@nx/remix').createWatchPaths(__dirname),
};
`
        );

        process.chdir(tempFs.tempDir);
      });

      afterEach(() => {
        jest.resetModules();
        tempFs.cleanup();
        process.chdir(cwd);
      });

      it('should create nodes', async () => {
        // ACT
        const nodes = await createNodesFunction(
          ['my-app/remix.config.cjs'],
          {
            buildTargetName: 'build',
            devTargetName: 'dev',
            startTargetName: 'start',
            typecheckTargetName: 'tsc',
            staticServeTargetName: 'static-serve',
          },
          context
        );

        // ASSERT
        expect(nodes).toMatchSnapshot();
      });
    });
  });

  describe('Remix Vite Compiler', () => {
    describe('root project', () => {
      const tempFs = new TempFs('test');

      beforeEach(() => {
        context = {
          nxJsonConfiguration: {
            targetDefaults: {
              build: {
                cache: false,
                inputs: ['foo', '^foo'],
              },
              dev: {
                command: 'npm run dev',
              },
              start: {
                command: 'npm run start',
              },
              typecheck: {
                command: 'tsc',
              },
            },
            namedInputs: {
              default: ['{projectRoot}/**/*'],
              production: ['!{projectRoot}/**/*.spec.ts'],
            },
          },
          workspaceRoot: tempFs.tempDir,
          configFiles: [],
        };
        tempFs.createFileSync(
          'package.json',
          JSON.stringify('{name: "my-app", type: "module"}')
        );
        tempFs.createFileSync(
          'vite.config.js',
          `const {defineConfig} = require('vite');
          const { vitePlugin: remix } = require('@remix-run/dev');
          module.exports = defineConfig({
             plugins:[remix()]
          });`
        );
        process.chdir(tempFs.tempDir);
        (loadViteDynamicImport as jest.Mock).mockResolvedValue({
          resolveConfig: jest.fn().mockResolvedValue({
            build: {
              lib: {
                entry: 'index.ts',
                name: 'my-app',
              },
            },
          }),
        });
      });

      afterEach(() => {
        jest.resetModules();
        tempFs.cleanup();
        process.chdir(cwd);
      });

      it('should create nodes', async () => {
        // ACT
        const nodes = await createNodesFunction(
          ['vite.config.js'],
          {
            buildTargetName: 'build',
            devTargetName: 'dev',
            startTargetName: 'start',
            typecheckTargetName: 'typecheck',
            staticServeTargetName: 'static-serve',
          },
          context
        );

        // ASSERT
        expect(nodes).toMatchSnapshot();
      });
    });

    describe('non-root project', () => {
      const tempFs = new TempFs('test');

      beforeEach(() => {
        context = {
          nxJsonConfiguration: {
            namedInputs: {
              default: ['{projectRoot}/**/*'],
              production: ['!{projectRoot}/**/*.spec.ts'],
            },
          },
          workspaceRoot: tempFs.tempDir,
          configFiles: [],
        };

        tempFs.createFileSync(
          'my-app/project.json',
          JSON.stringify({ name: 'my-app' })
        );

        tempFs.createFileSync(
          'my-app/vite.config.js',
          `const {defineConfig} = require('vite');
          const { vitePlugin: remix } = require('@remix-run/dev');
          module.exports = defineConfig({
             plugins:[remix()]
          });`
        );
        (loadViteDynamicImport as jest.Mock).mockResolvedValue({
          resolveConfig: jest.fn().mockResolvedValue({
            build: {
              lib: {
                entry: 'index.ts',
                name: 'my-app',
              },
            },
          }),
        });

        process.chdir(tempFs.tempDir);
      });

      afterEach(() => {
        jest.resetModules();
        tempFs.cleanup();
        process.chdir(cwd);
      });

      it('should create nodes', async () => {
        // ACT
        const nodes = await createNodesFunction(
          ['my-app/vite.config.js'],
          {
            buildTargetName: 'build',
            devTargetName: 'dev',
            startTargetName: 'start',
            typecheckTargetName: 'tsc',
            staticServeTargetName: 'static-serve',
          },
          context
        );

        // ASSERT
        expect(nodes).toMatchSnapshot();
      });
    });
  });
});
