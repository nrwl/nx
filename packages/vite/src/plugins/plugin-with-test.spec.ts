import { CreateNodesContextV2 } from '@nx/devkit';
import { createNodes, createNodesV2 } from './plugin';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';

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
  let context: CreateNodesContextV2;
  describe('root project', () => {
    let tempFs: TempFs;
    beforeEach(async () => {
      tempFs = new TempFs('vite-with-test-plugin');
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
        workspaceRoot: tempFs.tempDir,
      };
      tempFs.createFileSync('vite.config.ts', '');
      tempFs.createFileSync(
        'package.json',
        JSON.stringify({ name: 'vite', workspaces: ['*'] })
      );
      tempFs.createFileSync('package-lock.json', '{}');
      tempFs.createFileSync('tsconfig.lib.json', '{}');
      tempFs.createFileSync(
        'tsconfig.json',
        JSON.stringify({ extends: './tsconfig.base.json', files: [] })
      );
      tempFs.createFileSync(
        'tsconfig.base.json',
        JSON.stringify({ compilerOptions: { composite: true } })
      );
    });

    afterEach(() => {
      jest.resetModules();
      tempFs.cleanup();
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
