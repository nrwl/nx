import type { Mock } from 'vitest';
import {
  type CreateNodesContext,
  detectPackageManager,
  joinPathFragments,
} from '@nx/devkit';
import { createNodesV2 as createNodes } from './plugin';
import { loadViteDynamicImport } from '../utils/executor-utils';
import { isUsingTsSolutionSetup } from '@nx/js/internal';
import { getLockFileName } from '@nx/js';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import { workspaceDataDirectory } from '@nx/devkit/internal';
import { existsSync, readdirSync, rmSync } from 'fs';
import { join } from 'path';

vi.mock('../utils/executor-utils', () => ({
  loadViteDynamicImport: vi.fn().mockResolvedValue({
    resolveConfig: vi.fn().mockResolvedValue({}),
  }),
}));

vi.mock('@nx/js/internal', async () => ({
  ...(await vi.importActual<any>('@nx/js/internal')),
  isUsingTsSolutionSetup: vi.fn(),
}));

describe('@nx/remix/plugin', () => {
  let createNodesFunction = createNodes[1];
  let context: CreateNodesContext;
  let cwd = process.cwd();

  beforeEach(() => {
    (isUsingTsSolutionSetup as Mock).mockReturnValue(false);
    if (existsSync(workspaceDataDirectory)) {
      for (const file of readdirSync(workspaceDataDirectory)) {
        if (file.startsWith('remix-')) {
          rmSync(join(workspaceDataDirectory, file), { force: true });
        }
      }
    }
  });

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
            },
            namedInputs: {
              default: ['{projectRoot}/**/*'],
              production: ['!{projectRoot}/**/*.spec.ts'],
            },
          },
          workspaceRoot: tempFs.tempDir,
        };
        tempFs.createFileSync(
          'package.json',
          JSON.stringify('{name: "my-app", type: "module"}')
        );
        tempFs.createFileSync('package-lock.json', '{}');
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
        const lockFileName = getLockFileName(
          detectPackageManager(tempFs.tempDir)
        );
        tempFs.createFileSync(lockFileName, '');
        process.chdir(tempFs.tempDir);
      });

      afterEach(() => {
        vi.resetModules();
        process.chdir(cwd);
        tempFs.cleanup();
      });

      it('should create nodes', async () => {
        // ACT
        const nodes = await createNodesFunction(
          ['remix.config.cjs'],
          {
            buildTargetName: 'build',
            devTargetName: 'dev',
            startTargetName: 'start',
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
        };

        tempFs.createFileSync(
          'my-app/project.json',
          JSON.stringify({ name: 'my-app' })
        );
        tempFs.createFileSync('package-lock.json', '{}');
        const lockFileName = getLockFileName(
          detectPackageManager(tempFs.tempDir)
        );
        tempFs.createFileSync(lockFileName, '');

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
        vi.resetModules();
        process.chdir(cwd);
        tempFs.cleanup();
      });

      it('should create nodes', async () => {
        // ACT
        const nodes = await createNodesFunction(
          ['my-app/remix.config.cjs'],
          {
            buildTargetName: 'build',
            devTargetName: 'dev',
            startTargetName: 'start',
          },
          context
        );

        // ASSERT
        expect(nodes).toMatchSnapshot();
      });

      it('should infer watch-deps target', async () => {
        tempFs.createFileSync(
          'my-app/package.json',
          JSON.stringify('{"name": "my-app"}')
        );

        const nodes = await createNodesFunction(
          ['my-app/remix.config.cjs'],
          {
            buildTargetName: 'build',
            devTargetName: 'dev',
            startTargetName: 'start',
          },
          context
        );

        expect(nodes).toMatchSnapshot();
      });

      it('should not infer a typecheck target', async () => {
        tempFs.createFileSync('my-app/tsconfig.json', '{}');

        const nodes = await createNodesFunction(
          ['my-app/remix.config.cjs'],
          {},
          context
        );

        expect(
          nodes[0][1].projects['my-app'].targets.typecheck
        ).toBeUndefined();
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
            },
            namedInputs: {
              default: ['{projectRoot}/**/*'],
              production: ['!{projectRoot}/**/*.spec.ts'],
            },
          },
          workspaceRoot: tempFs.tempDir,
        };
        tempFs.createFileSync(
          'package.json',
          JSON.stringify('{name: "my-app", type: "module"}')
        );
        tempFs.createFileSync('package-lock.json', '{}');
        const lockFileName = getLockFileName(
          detectPackageManager(tempFs.tempDir)
        );
        tempFs.createFileSync(lockFileName, '');
        tempFs.createFileSync(
          'vite.config.js',
          `const {defineConfig} = require('vite');
          const { vitePlugin: remix } = require('@remix-run/dev');
          module.exports = defineConfig({
             plugins:[remix()]
          });`
        );
        process.chdir(tempFs.tempDir);
        (loadViteDynamicImport as Mock).mockResolvedValue({
          resolveConfig: vi.fn().mockResolvedValue({
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
        vi.resetModules();
        process.chdir(cwd);
        tempFs.cleanup();
      });

      it('should create nodes', async () => {
        // ACT
        const nodes = await createNodesFunction(
          ['vite.config.js'],
          {
            buildTargetName: 'build',
            devTargetName: 'dev',
            startTargetName: 'start',
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
        };

        tempFs.createFileSync(
          'my-app/project.json',
          JSON.stringify({ name: 'my-app' })
        );
        tempFs.createFileSync('package-lock.json', '{}');

        tempFs.createFileSync(
          'my-app/vite.config.js',
          `const {defineConfig} = require('vite');
          const { vitePlugin: remix } = require('@remix-run/dev');
          module.exports = defineConfig({
             plugins:[remix()]
          });`
        );
        (loadViteDynamicImport as Mock).mockResolvedValue({
          resolveConfig: vi.fn().mockResolvedValue({
            build: {
              lib: {
                entry: 'index.ts',
                name: 'my-app',
              },
            },
          }),
        });

        const lockFileName = getLockFileName(
          detectPackageManager(tempFs.tempDir)
        );
        tempFs.createFileSync(lockFileName, '');

        process.chdir(tempFs.tempDir);
      });

      afterEach(() => {
        vi.resetModules();
        process.chdir(cwd);
        tempFs.cleanup();
      });

      it('should create nodes', async () => {
        // ACT
        const nodes = await createNodesFunction(
          ['my-app/vite.config.js'],
          {
            buildTargetName: 'build',
            devTargetName: 'dev',
            startTargetName: 'start',
          },
          context
        );

        // ASSERT
        expect(nodes).toMatchSnapshot();
      });
    });
  });
});
