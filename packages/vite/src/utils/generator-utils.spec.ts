import {
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  findExistingJsBuildTargetInProject,
  getViteConfigPathForProject,
} from './generator-utils';
import {
  mockReactAppGenerator,
  mockViteReactAppGenerator,
  mockAngularAppGenerator,
} from './test-utils';
describe('generator utils', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  describe('getViteConfigPathForProject', () => {
    beforeEach(() => {
      mockViteReactAppGenerator(tree);
    });
    it('should return correct path for vite.config file if no configFile is set', () => {
      const viteConfigPath = getViteConfigPathForProject(
        tree,
        'my-test-react-vite-app'
      );
      expect(viteConfigPath).toEqual(
        'apps/my-test-react-vite-app/vite.config.ts'
      );
    });

    it('should return correct path for vite.config file if custom configFile is set', () => {
      const projectConfig = readProjectConfiguration(
        tree,
        'my-test-react-vite-app'
      );
      updateProjectConfiguration(tree, 'my-test-react-vite-app', {
        ...projectConfig,
        targets: {
          ...projectConfig.targets,
          build: {
            ...projectConfig.targets.build,
            options: {
              ...projectConfig.targets.build.options,
              configFile: 'apps/my-test-react-vite-app/vite.config.custom.ts',
            },
          },
        },
      });

      tree.write(`apps/my-test-react-vite-app/vite.config.custom.ts`, '');

      const viteConfigPath = getViteConfigPathForProject(
        tree,
        'my-test-react-vite-app'
      );
      expect(viteConfigPath).toEqual(
        'apps/my-test-react-vite-app/vite.config.custom.ts'
      );
    });

    it('should return correct path for vite.config file given a target name', () => {
      const projectConfig = readProjectConfiguration(
        tree,
        'my-test-react-vite-app'
      );
      updateProjectConfiguration(tree, 'my-test-react-vite-app', {
        ...projectConfig,
        targets: {
          ...projectConfig.targets,
          'other-build': {
            ...projectConfig.targets.build,
            options: {
              ...projectConfig.targets.build.options,
              configFile: 'apps/my-test-react-vite-app/vite.other.custom.ts',
            },
          },
        },
      });

      tree.write(`apps/my-test-react-vite-app/vite.other.custom.ts`, '');

      const viteConfigPath = getViteConfigPathForProject(
        tree,
        'my-test-react-vite-app',
        'other-build'
      );
      expect(viteConfigPath).toEqual(
        'apps/my-test-react-vite-app/vite.other.custom.ts'
      );
    });
  });

  describe('findExistingJsBuildTargetInProject', () => {
    it('should return no targets', () => {
      mockReactAppGenerator(tree);
      const { targets } = readProjectConfiguration(tree, 'my-test-react-app');

      const existingTargets = findExistingJsBuildTargetInProject(targets);
      expect(existingTargets).toMatchObject({});
    });

    it('should return the correct - undefined - targets for Angular apps', () => {
      mockAngularAppGenerator(tree);
      const { targets } = readProjectConfiguration(tree, 'my-test-angular-app');
      const existingTargets = findExistingJsBuildTargetInProject(targets);
      expect(existingTargets).toMatchObject({
        unsupported: 'build',
      });
    });
  });
});
