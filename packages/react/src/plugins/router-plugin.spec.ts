import { CreateNodesContext } from '@nx/devkit';
import { createNodes } from './router-plugin';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { loadConfigFile } from '@nx/devkit/src/utils/config-utils';

jest.mock('../utils/load-vite-dynamic', () => ({
  loadViteDynamicImport: jest.fn().mockResolvedValue({
    resolveConfig: jest.fn().mockResolvedValue({}),
  }),
}));

jest.mock('@nx/devkit/src/utils/config-utils', () => {
  return {
    ...jest.requireActual('@nx/devkit/src/utils/config-utils'),
    loadConfigFile: jest.fn(),
  };
});

jest.mock('@nx/js/src/utils/typescript/ts-solution-setup', () => ({
  ...jest.requireActual('@nx/js/src/utils/typescript/ts-solution-setup'),
  isUsingTsSolutionSetup: jest.fn(),
}));

describe('@nx/react/react-router-plugin', () => {
  let createNodesFunction = createNodes[1];
  let context: CreateNodesContext;
  let cwd = process.cwd();

  beforeEach(() => {
    (isUsingTsSolutionSetup as jest.Mock).mockReturnValue(false);
  });

  describe('React Router', () => {
    describe('root project', () => {
      const tempFs = new TempFs('temp');

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
          'package.json',
          JSON.stringify({ name: 'acme', type: 'module' })
        );
        tempFs.createFileSync('react-router.config.js', JSON.stringify({}));
        tempFs.createFileSync('vite.config.js', JSON.stringify({}));
      });

      afterEach(() => {
        jest.resetModules();
      });

      it('should create nodes by default', async () => {
        const configPath = 'react-router.config.js';
        (loadConfigFile as jest.Mock).mockReturnValue({});
        mockConfig('vite.config.js', {});

        const nodes = await createNodesFunction(
          [configPath],
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
        const configPath = 'react-router.config.js';
        (loadConfigFile as jest.Mock).mockReturnValue({ ssr: false });
        mockConfig('vite.config.js', {});

        const nodes = await createNodesFunction(
          [configPath],
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

    describe('integrated projects', () => {
      let tempFs: TempFs;

      beforeEach(() => {
        tempFs = new TempFs('test');
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
          'acme/project.json',
          JSON.stringify({ name: 'acme' })
        );

        tempFs.createFileSync('acme/react-router.config.js', '');
        tempFs.createFileSync('acme/vite.config.js', '');
      });

      afterEach(() => {
        jest.resetModules();
        tempFs.cleanup();
      });

      it('should create nodes by default', async () => {
        (loadConfigFile as jest.Mock).mockReturnValue({});
        mockConfig('acme/vite.config.js', {});

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
        (loadConfigFile as jest.Mock).mockReturnValue({ ssr: false });
        mockConfig('acme/vite.config.js', {});

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
  });
});

function mockConfig(path: string, config: any) {
  jest.mock(
    path,
    () => ({
      default: config,
    }),
    {
      virtual: true,
    }
  );
}
