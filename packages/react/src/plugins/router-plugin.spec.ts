import { type CreateNodesContext } from '@nx/devkit';
import { createNodesV2 } from './router-plugin';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { join } from 'path';

jest.mock('nx/src/utils/cache-directory', () => ({
  ...jest.requireActual('nx/src/utils/cache-directory'),
  workspaceDataDirectory: 'tmp/project-graph-cache',
}));

jest.mock('@nx/js/src/utils/typescript/ts-solution-setup', () => ({
  ...jest.requireActual('@nx/js/src/utils/typescript/ts-solution-setup'),
  isUsingTsSolutionSetup: jest.fn(),
}));

describe('@nx/react/react-router-plugin', () => {
  let createNodesFunction = createNodesV2[1];
  let context: CreateNodesContext;
  let tempFs: TempFs;
  let cwd: string;

  beforeEach(() => {
    (isUsingTsSolutionSetup as jest.Mock).mockReturnValue(false);
  });

  describe('React Router', () => {
    beforeEach(async () => {
      tempFs = new TempFs('test');
      cwd = process.cwd();
      process.chdir(tempFs.tempDir);

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

      await tempFs.createFiles({
        'acme/react-router.config.js': 'module.exports = {}',
        'acme/vite.config.js': '',
        'acme/project.json': JSON.stringify({ name: 'acme' }),
      });
    });

    afterEach(() => {
      jest.resetModules();
      tempFs.cleanup();
      process.chdir(cwd);
    });

    it('should create nodes by default', async () => {
      mockConfig('acme/react-router.config.js', {}, context);

      const nodes = await createNodesFunction(
        ['acme/react-router.config.js'],
        {
          buildTargetName: 'build',
          devTargetName: 'dev',
          startTargetName: 'start',
        },
        context
      );

      expect(nodes).toMatchSnapshot();
    });

    it('should create nodes without start target if ssr is false', async () => {
      mockConfig('acme/react-router.config.js', { ssr: false }, context);

      const nodes = await createNodesFunction(
        ['acme/react-router.config.js'],
        {
          buildTargetName: 'build',
          devTargetName: 'dev',
          startTargetName: 'start',
        },
        context
      );

      expect(nodes).toMatchSnapshot();
    });
  });

  function mockConfig(path: string, config, context: CreateNodesContext) {
    jest.mock(join(context.workspaceRoot, path), () => config, {
      virtual: true,
    });
  }
});
