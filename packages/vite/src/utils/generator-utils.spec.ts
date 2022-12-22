import {
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nrwl/devkit';
import { createTreeWithEmptyV1Workspace } from '@nrwl/devkit/testing';
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

  describe('findExistingTargetsInProject', () => {
    it('should return the correct targets', () => {
      mockReactAppGenerator(tree);
      const { targets } = readProjectConfiguration(tree, 'my-test-react-app');

      const existingTargets = findExistingTargetsInProject(targets);
      expect(existingTargets).toMatchObject({
        userProvidedTargetIsUnsupported: {
          build: undefined,
          serve: undefined,
          test: undefined,
        },
        validFoundTargetName: {
          build: 'build',
          serve: 'serve',
          test: 'test',
        },
        projectContainsUnsupportedExecutor: undefined,
      });
    });

    it('should return the correct - undefined - targets for Angular apps', () => {
      mockAngularAppGenerator(tree);
      const { targets } = readProjectConfiguration(tree, 'my-test-angular-app');
      const existingTargets = findExistingTargetsInProject(targets);
      expect(existingTargets).toMatchObject({
        userProvidedTargetIsUnsupported: {
          build: undefined,
          serve: undefined,
          test: undefined,
        },
        validFoundTargetName: {
          build: undefined,
          serve: undefined,
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
      expect.assertions(2);
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

      try {
        await handleUnsupportedUserProvidedTargets(
          object.unsupportedUserProvidedTarget,
          object.userProvidedTargets,
          object.targets
        );
        throw new Error('should not reach here');
      } catch (e) {
        expect(e).toBeDefined();
        expect(e.toString()).toContain(
          'The build target my-build cannot be converted to use the @nrwl/vite:build executor'
        );
      }
    });

    it('should NOT throw error if unsupported and user confirms', async () => {
      const { Confirm } = require('enquirer');
      const confirmSpy = jest.spyOn(Confirm.prototype, 'run');
      confirmSpy.mockResolvedValue(true);
      expect.assertions(2);
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

      expect(
        handleUnsupportedUserProvidedTargets(
          object.unsupportedUserProvidedTarget,
          object.userProvidedTargets,
          object.targets
        )
      ).resolves.toBeUndefined();

      const response = await handleUnsupportedUserProvidedTargets(
        object.unsupportedUserProvidedTarget,
        object.userProvidedTargets,
        object.targets
      );
      expect(response).toBeUndefined();
    });
  });
});
