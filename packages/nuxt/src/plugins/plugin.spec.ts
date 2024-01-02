import { CreateNodesContext } from '@nx/devkit';
import { createNodes } from './plugin';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';

jest.mock('@nuxt/kit', () => ({
  loadNuxtConfig: jest.fn().mockImplementation(() => {
    return Promise.resolve({
      buildDir: '../dist/my-app/.nuxt',
    });
  }),
}));

jest.mock('../utils/executor-utils', () => ({
  loadNuxtKitDynamicImport: jest.fn().mockResolvedValue({
    loadNuxtConfig: jest.fn().mockResolvedValue({
      buildDir: '../dist/my-app/.nuxt',
    }),
  }),
}));
describe('@nx/nuxt/plugin', () => {
  let createNodesFunction = createNodes[1];
  let context: CreateNodesContext;

  describe('root project', () => {
    beforeEach(async () => {
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
    });

    afterEach(() => {
      jest.resetModules();
    });

    it('should create nodes', async () => {
      const nodes = await createNodesFunction(
        'nuxt.config.ts',
        {
          buildTargetName: 'build',
          serveTargetName: 'serve',
        },
        context
      );

      expect(nodes).toMatchSnapshot();
    });
  });

  describe('not root project', () => {
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
      tempFs.createFileSync('my-app/nuxt.config.ts', '');
    });

    afterEach(() => {
      jest.resetModules();
    });

    it('should create nodes', async () => {
      const nodes = await createNodesFunction(
        'my-app/nuxt.config.ts',
        {
          buildTargetName: 'build-something',
          serveTargetName: 'my-serve',
        },
        context
      );

      expect(nodes).toMatchSnapshot();
    });
  });
});
