import { CreateNodesContext } from '@nx/devkit';
import { createNodes, createNodesV2 } from './plugin';

// This will only create test targets since no build targets are defined in vite.config.ts

jest.mock('../utils/executor-utils', () => ({
  loadViteDynamicImport: jest.fn().mockResolvedValue({
    resolveConfig: jest.fn().mockResolvedValue({
      test: {
        some: 'option',
      },
    }),
  }),
}));

describe('@nx/vite/plugin with test node', () => {
  let createNodesFunction = createNodesV2[1];
  let context: CreateNodesContext;
  describe('root project', () => {
    beforeEach(async () => {
      context = {
        configFiles: [],
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
    });

    afterEach(() => {
      jest.resetModules();
    });

    it('should create nodes - with test too', async () => {
      const nodes = await createNodesFunction(
        ['vite.config.ts'],
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
});
