import {
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  findExistingTargetsInProject,
  getViteConfigPathForProject,
  handleUnsupportedUserProvidedTargets,
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

  describe('findExistingTargetsInProject', () => {
    it('should return the correct targets', () => {
      mockReactAppGenerator(tree);
      const { targets } = readProjectConfiguration(tree, 'my-test-react-app');

      const existingTargets = findExistingTargetsInProject(targets);
      expect(existingTargets).toMatchObject({
        userProvidedTargetIsUnsupported: {},
        validFoundTargetName: {
          build: 'build',
          serve: 'serve',
          test: 'test',
        },
        projectContainsUnsupportedExecutor: false,
      });
    });

    it('should return the correct - undefined - targets for Angular apps', () => {
      mockAngularAppGenerator(tree);
      const { targets } = readProjectConfiguration(tree, 'my-test-angular-app');
      const existingTargets = findExistingTargetsInProject(targets);
      expect(existingTargets).toMatchObject({
        userProvidedTargetIsUnsupported: {},
        validFoundTargetName: {
          test: 'test',
        },
        projectContainsUnsupportedExecutor: true,
      });
    });
  });

  describe('handleUnsupportedUserProvidedTargets', () => {
    afterEach(() => {
      jest.clearAllMocks();
    });
    it('should throw error if unsupported and user does not want to confirm', async () => {
      const { Confirm } = require('enquirer');
      const confirmSpy = jest.spyOn(Confirm.prototype, 'run');
      confirmSpy.mockResolvedValueOnce(false);
      const object = {
        unsupportedUserProvidedTarget: {
          build: true,
        },
        userProvidedTargets: {
          build: 'my-build',
          serve: 'my-serve',
          test: 'my-test',
        },
        targets: {
          build: 'build',
          serve: 'serve',
          test: 'test',
        },
      };

      expect(async () => {
        await handleUnsupportedUserProvidedTargets(
          object.unsupportedUserProvidedTarget,
          object.userProvidedTargets,
          object.targets
        );
      }).rejects.toThrowErrorMatchingInlineSnapshot(`
        "The build target my-build cannot be converted to use the @nx/vite:build executor.
              Please try again, either by providing a different build target or by not providing a target at all (Nx will
                convert the first one it finds, most probably this one: build)

              Please note that converting a potentially non-compatible project to use Vite.js may result in unexpected behavior. Always commit
              your changes before converting a project to use Vite.js, and test the converted project thoroughly before deploying it.
              "
      `);
    });

    it('should NOT throw error if unsupported and user confirms', async () => {
      const { Confirm } = require('enquirer');
      const confirmSpy = jest.spyOn(Confirm.prototype, 'run');
      confirmSpy.mockResolvedValue(true);
      const object = {
        unsupportedUserProvidedTarget: {
          build: true,
        },
        userProvidedTargets: {
          build: 'my-build',
          serve: 'my-serve',
          test: 'my-test',
        },
        targets: {
          build: 'build',
          serve: 'serve',
          test: 'test',
        },
      };

      expect(async () => {
        await handleUnsupportedUserProvidedTargets(
          object.unsupportedUserProvidedTarget,
          object.userProvidedTargets,
          object.targets
        );
      }).not.toThrow();
    });
  });
});
