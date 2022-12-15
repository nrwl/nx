import {
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nrwl/devkit';
import { createTreeWithEmptyV1Workspace } from '@nrwl/devkit/testing';
import {
  findExistingTargets,
  getViteConfigPathForProject,
} from './generator-utils';
import { mockReactAppGenerator, mockViteReactAppGenerator } from './test-utils';
describe('generator utils', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyV1Workspace();
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

  describe('findExistingTargets', () => {
    beforeEach(() => {
      mockReactAppGenerator(tree);
    });
    it('should return the correct targets', () => {
      const { targets } = readProjectConfiguration(tree, 'my-test-react-app');

      const existingTargets = findExistingTargets(targets);
      expect(existingTargets).toMatchObject({
        buildTarget: 'build',
        serveTarget: 'serve',
        testTarget: 'test',
        unsuppored: undefined,
      });
    });
  });
});
