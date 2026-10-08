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
        tempFs.cleanup();
        process.chdir(cwd);
      });

      it('should create nodes', async () => {
        tempFs.createFileSync('tsconfig.json', '{}');

        // ACT
        const nodes = await createNodesFunction(
          ['remix.config.cjs'],
          {
            buildTargetName: 'build',
            devTargetName: 'dev',
            startTargetName: 'start',
            typecheckTargetName: 'typecheck',
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
        tempFs.cleanup();
        process.chdir(cwd);
      });

      it('should create nodes', async () => {
        tempFs.createFileSync('my-app/tsconfig.json', '{}');
        tempFs.createFileSync('my-app/tsconfig.app.json', '{}');

        // ACT
        const nodes = await createNodesFunction(
          ['my-app/remix.config.cjs'],
          {
            buildTargetName: 'build',
            devTargetName: 'dev',
            startTargetName: 'start',
            typecheckTargetName: 'tsc',
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
            typecheckTargetName: 'tsc',
          },
          context
        );

        expect(nodes).toMatchSnapshot();
      });

      it('should infer typecheck without --build flag when not using TS solution setup', async () => {
        tempFs.createFileSync(
          'my-app/package.json',
          JSON.stringify('{"name": "my-app"}')
        );
        tempFs.createFileSync('my-app/tsconfig.json', '{}');

        const nodes = await createNodesFunction(
          ['my-app/remix.config.cjs'],
          { typecheckTargetName: 'typecheck' },
          context
        );

        expect(
          nodes[0][1].projects['my-app'].targets.typecheck.command
        ).toEqual(`tsc --noEmit`);
        expect(nodes[0][1].projects['my-app'].targets.typecheck.metadata)
          .toMatchInlineSnapshot(`
          {
            "description": "Runs type-checking for the project.",
            "help": {
              "command": "npx tsc --help",
              "example": {
                "options": {
                  "noEmit": true,
                },
              },
            },
            "technologies": [
              "typescript",
            ],
          }
        `);
        expect(
          nodes[0][1].projects['my-app'].targets.typecheck.dependsOn
        ).toBeUndefined();
        expect(
          nodes[0][1].projects['my-app'].targets.typecheck.syncGenerators
        ).toBeUndefined();
      });

      it('should not infer typecheck when using TS solution setup', async () => {
        (isUsingTsSolutionSetup as Mock).mockReturnValue(true);
        tempFs.createFileSync(
          'my-app/package.json',
          JSON.stringify('{"name": "my-app", "version": "0.0.0"}')
        );
        tempFs.createFileSync('my-app/tsconfig.json', '{}');

        const nodes = await createNodesFunction(
          ['my-app/remix.config.cjs'],
          { typecheckTargetName: 'typecheck' },
          context
        );

        expect(
          nodes[0][1].projects['my-app'].targets.typecheck
        ).toBeUndefined();
      });

      it('should not infer typecheck when the project has no tsconfig', async () => {
        const nodes = await createNodesFunction(
          ['my-app/remix.config.cjs'],
          { typecheckTargetName: 'typecheck' },
          context
        );

        expect(
          nodes[0][1].projects['my-app'].targets.typecheck
        ).toBeUndefined();
      });

      it('should check tsconfig.lib.json when there is no tsconfig.app.json', async () => {
        tempFs.createFileSync('my-app/tsconfig.json', '{}');
        tempFs.createFileSync('my-app/tsconfig.lib.json', '{}');

        const nodes = await createNodesFunction(
          ['my-app/remix.config.cjs'],
          { typecheckTargetName: 'typecheck' },
          context
        );

        expect(
          nodes[0][1].projects['my-app'].targets.typecheck.command
        ).toEqual('tsc -p tsconfig.lib.json --noEmit');
      });

      it('should not infer typecheck when typecheckTargetName is false', async () => {
        tempFs.createFileSync('my-app/tsconfig.json', '{}');

        const nodes = await createNodesFunction(
          ['my-app/remix.config.cjs'],
          { typecheckTargetName: false },
          context
        );

        const targets = nodes[0][1].projects['my-app'].targets;
        expect(targets.typecheck).toBeUndefined();
        expect(targets['false']).toBeUndefined();
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
        tempFs.cleanup();
        process.chdir(cwd);
      });

      it('should create nodes', async () => {
        tempFs.createFileSync('tsconfig.json', '{}');
        tempFs.createFileSync('tsconfig.app.json', '{}');

        // ACT
        const nodes = await createNodesFunction(
          ['vite.config.js'],
          {
            buildTargetName: 'build',
            devTargetName: 'dev',
            startTargetName: 'start',
            typecheckTargetName: 'typecheck',
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
        tempFs.cleanup();
        process.chdir(cwd);
      });

      it('should create nodes', async () => {
        tempFs.createFileSync('my-app/tsconfig.json', '{}');

        // ACT
        const nodes = await createNodesFunction(
          ['my-app/vite.config.js'],
          {
            buildTargetName: 'build',
            devTargetName: 'dev',
            startTargetName: 'start',
            typecheckTargetName: 'tsc',
          },
          context
        );

        // ASSERT
        expect(nodes).toMatchSnapshot();
      });
    });
  });
});
