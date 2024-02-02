import { CreateNodesContext } from '@nx/devkit';
import { createNodes } from './plugin';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';

jest.mock('vite', () => ({
  resolveConfig: jest.fn().mockImplementation(() => {
    return Promise.resolve({
      path: 'vite.config.ts',
      config: {},
      build: {},
      dependencies: [],
    });
  }),
}));

jest.mock('../utils/executor-utils', () => ({
  loadViteDynamicImport: jest.fn().mockResolvedValue({
    resolveConfig: jest.fn().mockResolvedValue({
      path: 'vite.config.ts',
      config: {},
      dependencies: [],
    }),
  }),
}));

describe('@nx/vite/plugin', () => {
  let createNodesFunction = createNodes[1];
  let context: CreateNodesContext;
  describe('root project', () => {
    let tempFs;
    beforeEach(async () => {
      tempFs = new TempFs('vite-plugin-tests');
      context = {
        nxJsonConfiguration: {
          // These defaults should be overridden by plugin
          targetDefaults: {
            build: {
              cache: false,
              inputs: ['foo', '^foo'],
            },
          },
          namedInputs: {
            default: ['{projectRoot}/**/*'],
            production: ['!{projectRoot}/**/*.spec.ts'],
          },
        },
        workspaceRoot: '',
      };
      tempFs.createFileSync('index.html', '');
    });

    afterEach(() => {
      jest.resetModules();
    });

    it('should create nodes', async () => {
      const nodes = await createNodesFunction(
        'vite.config.ts',
        {
          buildTargetName: 'build',
          serveTargetName: 'serve',
          previewTargetName: 'preview',
          testTargetName: 'test',
          serveStaticTargetName: 'serve-static',
        },
        context
      );

      expect(nodes).toMatchSnapshot();
    });
  });

  describe('not root project', () => {
    let tempFs;
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
      };

      tempFs.createFileSync(
        'my-app/project.json',
        JSON.stringify({ name: 'my-app' })
      );
      tempFs.createFileSync('my-app/vite.config.ts', '');
      tempFs.createFileSync('my-app/index.html', '');
    });

    afterEach(() => {
      jest.resetModules();
    });

    it('should create nodes', async () => {
      const nodes = await createNodesFunction(
        'my-app/vite.config.ts',
        {
          buildTargetName: 'build-something',
          serveTargetName: 'my-serve',
          previewTargetName: 'preview-site',
          testTargetName: 'vitest',
          serveStaticTargetName: 'serve-static',
        },
        context
      );

      expect(nodes).toMatchSnapshot();
    });
  });
});
