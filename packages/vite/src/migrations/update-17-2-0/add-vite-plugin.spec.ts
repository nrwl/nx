import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import update from './add-vite-plugin';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';

jest.mock('vite', () => ({
  loadConfigFromFile: jest.fn().mockImplementation(() => {
    return Promise.resolve({
      path: 'vite.config.ts',
      config: {},
      dependencies: [],
    });
  }),
}));
describe('add-vite-plugin migration', () => {
  let tree: Tree;
  let tempFs: TempFs;

  describe('not root project', () => {
    beforeEach(async () => {
      tempFs = new TempFs('test');
      tree = createTreeWithEmptyWorkspace();
      tree.root = tempFs.tempDir;
      await tempFs.createFiles({
        'apps/my-app/vite.config.ts': '',
        'apps/my-app/project.json': '{ "name": "my-app" }',
      });
      tree.write('apps/my-app/vite.config.ts', `console.log('hi');`);
    });

    afterEach(() => {
      jest.resetModules();
      tempFs.cleanup();
    });

    it('should remove the serve target', async () => {
      updateProjectConfiguration(tree, 'my-app', {
        root: 'apps/my-app',
        targets: {
          serve: {
            executor: '@nx/vite:dev-server',
            defaultConfiguration: 'development',
            options: {
              buildTarget: 'build',
            },
            configurations: {
              development: {
                buildTarget: 'build:development',
                hmr: true,
              },
              production: {
                buildTarget: 'build:production',
                hmr: false,
              },
            },
          },
        },
      });

      await update(tree);

      expect(
        readProjectConfiguration(tree, 'my-app').targets.serve
      ).toBeUndefined();
    });

    it('should remove the serve, serve-static and build target, but keep other targets', async () => {
      updateProjectConfiguration(tree, 'my-app', {
        root: 'apps/my-app',
        targets: {
          build: {
            executor: '@nx/vite:build',
            outputs: ['{options.outputPath}'],
            defaultConfiguration: 'production',
            options: {
              outputPath: 'dist/apps/my-app',
            },
            configurations: {
              development: {
                mode: 'development',
              },
              production: {
                mode: 'production',
              },
            },
          },
          serve: {
            executor: '@nx/vite:dev-server',
            defaultConfiguration: 'development',
            options: {
              buildTarget: 'build',
            },
            configurations: {
              development: {
                buildTarget: 'build:development',
                hmr: true,
              },
              production: {
                buildTarget: 'build:production',
                hmr: false,
              },
            },
          },
          'preview-custom': {
            executor: '@nx/vite:preview-server',
            defaultConfiguration: 'development',
            options: {
              buildTarget: 'build',
            },
            configurations: {
              development: {
                buildTarget: 'build:development',
              },
              production: {
                buildTarget: 'build:production',
              },
            },
          },
          'test-custom': {
            executor: '@nx/vite:test',
            outputs: ['{options.reportsDirectory}'],
            options: {
              passWithNoTests: true,
              reportsDirectory: '../../coverage/apps/my-app',
            },
          },
          lint: {
            executor: '@nx/eslint:lint',
            outputs: ['{options.outputFile}'],
            options: {
              lintFilePatterns: ['apps/my-app/**/*.{ts,tsx,js,jsx}'],
            },
          },
          'serve-static': {
            executor: '@nx/web:file-server',
            options: {
              buildTarget: 'my-app:build',
            },
          },
        },
      });

      await update(tree);

      expect(
        readProjectConfiguration(tree, 'my-app').targets.serve
      ).toBeUndefined();

      expect(
        readProjectConfiguration(tree, 'my-app').targets.build
      ).toBeUndefined();

      expect(
        readProjectConfiguration(tree, 'my-app').targets['preview-custom']
      ).toBeDefined();

      expect(
        readProjectConfiguration(tree, 'my-app').targets['lint']
      ).toBeDefined();

      expect(
        readProjectConfiguration(tree, 'my-app').targets['test-custom']
      ).toBeDefined();

      expect(
        readProjectConfiguration(tree, 'my-app').targets['serve-static']
      ).toBeUndefined();
    });
  });

  describe('root project', () => {
    beforeEach(async () => {
      tempFs = new TempFs('test');
      tree = createTreeWithEmptyWorkspace();
      tree.root = tempFs.tempDir;
      await tempFs.createFiles({
        'vite.config.ts': '',
        'project.json': '{ "name": "my-app" }',
      });
      tree.write('vite.config.ts', `console.log('hi');`);
    });

    afterEach(() => {
      jest.resetModules();
      tempFs.cleanup();
    });

    it('should remove the serve target', async () => {
      updateProjectConfiguration(tree, 'my-app', {
        root: '.',
        targets: {
          serve: {
            executor: '@nx/vite:dev-server',
            defaultConfiguration: 'development',
            options: {
              buildTarget: 'build',
            },
            configurations: {
              development: {
                buildTarget: 'build:development',
                hmr: true,
              },
              production: {
                buildTarget: 'build:production',
                hmr: false,
              },
            },
          },
        },
      });

      await update(tree);

      expect(
        readProjectConfiguration(tree, 'my-app').targets.serve
      ).toBeUndefined();
    });
  });
});
