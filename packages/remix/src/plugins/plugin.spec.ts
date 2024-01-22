import { type CreateNodesContext, joinPathFragments } from '@nx/devkit';
import { createNodes } from './plugin';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';

describe('@nx/remix/plugin', () => {
  let createNodesFunction = createNodes[1];
  let context: CreateNodesContext;
  let cwd = process.cwd();

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
            serve: {
              command: 'npm run serve',
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
        'remix.config.cjs',
        {
          buildTargetName: 'build',
          serveTargetName: 'serve',
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
        'my-app/remix.config.cjs',
        {
          buildTargetName: 'build',
          serveTargetName: 'serve',
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
