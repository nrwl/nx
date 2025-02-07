import {
  type CreateNodesContext,
  detectPackageManager,
  joinPathFragments,
} from '@nx/devkit';
import { createNodesV2 as createNodes } from './plugin';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';
import { loadViteDynamicImport } from '../utils/executor-utils';
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { getLockFileName } from '@nx/js';

jest.mock('../utils/executor-utils', () => ({
  loadViteDynamicImport: jest.fn().mockResolvedValue({
    resolveConfig: jest.fn().mockResolvedValue({}),
  }),
}));

jest.mock('@nx/js/src/utils/typescript/ts-solution-setup', () => ({
  ...jest.requireActual('@nx/js/src/utils/typescript/ts-solution-setup'),
  isUsingTsSolutionSetup: jest.fn(),
}));

describe('@nx/remix/plugin', () => {
  let createNodesFunction = createNodes[1];
  let context: CreateNodesContext;
  let cwd = process.cwd();

  beforeEach(() => {
    (isUsingTsSolutionSetup as jest.Mock).mockReturnValue(false);
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
        const lockFileName = getLockFileName(
          detectPackageManager(tempFs.tempDir)
        );
        tempFs.createFileSync(lockFileName, '');
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
            staticServeTargetName: 'static-serve',
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

      it('should infer typecheck with --build flag when using TS solution setup', async () => {
        (isUsingTsSolutionSetup as jest.Mock).mockReturnValue(true);
        tempFs.createFileSync(
          'my-app/package.json',
          JSON.stringify('{"name": "my-app", "version": "0.0.0"}')
        );

        const nodes = await createNodesFunction(
          ['my-app/remix.config.cjs'],
          { typecheckTargetName: 'typecheck' },
          context
        );

        expect(
          nodes[0][1].projects['my-app'].targets.typecheck.command
        ).toEqual(`tsc --build --emitDeclarationOnly`);
        expect(nodes[0][1].projects['my-app'].targets.typecheck.metadata)
          .toMatchInlineSnapshot(`
          {
            "description": "Runs type-checking for the project.",
            "help": {
              "command": "npx tsc --build --help",
              "example": {
                "args": [
                  "--force",
                ],
              },
            },
            "technologies": [
              "typescript",
            ],
          }
        `);
        expect(
          nodes[0][1].projects['my-app'].targets.typecheck.dependsOn
        ).toEqual([`^typecheck`]);
        expect(
          nodes[0][1].projects['my-app'].targets.typecheck.syncGenerators
        ).toEqual(['@nx/js:typescript-sync']);
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

        const lockFileName = getLockFileName(
          detectPackageManager(tempFs.tempDir)
        );
        tempFs.createFileSync(lockFileName, '');

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
