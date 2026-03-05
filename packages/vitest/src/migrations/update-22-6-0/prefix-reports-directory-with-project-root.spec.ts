import {
  addProjectConfiguration,
  readNxJson,
  readProjectConfiguration,
  type Tree,
  updateNxJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import prefixReportsDirectoryWithProjectRoot from './prefix-reports-directory-with-project-root';

describe('prefix-reports-directory-with-project-root', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  describe('project configuration migration', () => {
    it('should prepend {projectRoot}/ to reportsDirectory for @nx/vitest:test', () => {
      addProjectConfiguration(tree, 'my-lib', {
        root: 'libs/my-lib',
        targets: {
          test: {
            executor: '@nx/vitest:test',
            options: {
              reportsDirectory: 'coverage/libs/my-lib',
            },
          },
        },
      });

      prefixReportsDirectoryWithProjectRoot(tree);

      const projectConfig = readProjectConfiguration(tree, 'my-lib');
      expect(projectConfig.targets.test.options.reportsDirectory).toBe(
        '{projectRoot}/coverage/libs/my-lib'
      );
    });

    it('should prepend {projectRoot}/ to reportsDirectory for @nx/vite:test', () => {
      addProjectConfiguration(tree, 'my-lib', {
        root: 'libs/my-lib',
        targets: {
          test: {
            executor: '@nx/vite:test',
            options: {
              reportsDirectory: 'coverage/libs/my-lib',
            },
          },
        },
      });

      prefixReportsDirectoryWithProjectRoot(tree);

      const projectConfig = readProjectConfiguration(tree, 'my-lib');
      expect(projectConfig.targets.test.options.reportsDirectory).toBe(
        '{projectRoot}/coverage/libs/my-lib'
      );
    });

    it('should migrate reportsDirectory in target configurations', () => {
      addProjectConfiguration(tree, 'my-lib', {
        root: 'libs/my-lib',
        targets: {
          test: {
            executor: '@nx/vitest:test',
            options: {
              reportsDirectory: 'coverage/libs/my-lib',
            },
            configurations: {
              ci: {
                reportsDirectory: 'reports/ci/my-lib',
              },
            },
          },
        },
      });

      prefixReportsDirectoryWithProjectRoot(tree);

      const projectConfig = readProjectConfiguration(tree, 'my-lib');
      expect(projectConfig.targets.test.options.reportsDirectory).toBe(
        '{projectRoot}/coverage/libs/my-lib'
      );
      expect(
        projectConfig.targets.test.configurations.ci.reportsDirectory
      ).toBe('{projectRoot}/reports/ci/my-lib');
    });

    it('should not modify reportsDirectory that already has {projectRoot}', () => {
      addProjectConfiguration(tree, 'my-lib', {
        root: 'libs/my-lib',
        targets: {
          test: {
            executor: '@nx/vitest:test',
            options: {
              reportsDirectory: '{projectRoot}/coverage',
            },
          },
        },
      });

      prefixReportsDirectoryWithProjectRoot(tree);

      const projectConfig = readProjectConfiguration(tree, 'my-lib');
      expect(projectConfig.targets.test.options.reportsDirectory).toBe(
        '{projectRoot}/coverage'
      );
    });

    it('should not modify absolute reportsDirectory paths', () => {
      addProjectConfiguration(tree, 'my-lib', {
        root: 'libs/my-lib',
        targets: {
          test: {
            executor: '@nx/vitest:test',
            options: {
              reportsDirectory: '/absolute/path/to/coverage',
            },
          },
        },
      });

      prefixReportsDirectoryWithProjectRoot(tree);

      const projectConfig = readProjectConfiguration(tree, 'my-lib');
      expect(projectConfig.targets.test.options.reportsDirectory).toBe(
        '/absolute/path/to/coverage'
      );
    });

    it('should not modify projects without reportsDirectory', () => {
      addProjectConfiguration(tree, 'my-lib', {
        root: 'libs/my-lib',
        targets: {
          test: {
            executor: '@nx/vitest:test',
            options: {
              configFile: 'libs/my-lib/vite.config.ts',
            },
          },
        },
      });

      prefixReportsDirectoryWithProjectRoot(tree);

      const projectConfig = readProjectConfiguration(tree, 'my-lib');
      expect(
        projectConfig.targets.test.options.reportsDirectory
      ).toBeUndefined();
    });

    it('should not modify other executors', () => {
      addProjectConfiguration(tree, 'my-lib', {
        root: 'libs/my-lib',
        targets: {
          test: {
            executor: '@nx/jest:jest',
            options: {
              reportsDirectory: 'coverage/libs/my-lib',
            },
          },
        },
      });

      prefixReportsDirectoryWithProjectRoot(tree);

      const projectConfig = readProjectConfiguration(tree, 'my-lib');
      expect(projectConfig.targets.test.options.reportsDirectory).toBe(
        'coverage/libs/my-lib'
      );
    });

    it('should migrate multiple projects', () => {
      addProjectConfiguration(tree, 'lib-a', {
        root: 'libs/lib-a',
        targets: {
          test: {
            executor: '@nx/vitest:test',
            options: {
              reportsDirectory: 'coverage/libs/lib-a',
            },
          },
        },
      });

      addProjectConfiguration(tree, 'lib-b', {
        root: 'libs/lib-b',
        targets: {
          test: {
            executor: '@nx/vitest:test',
            options: {
              reportsDirectory: 'coverage/libs/lib-b',
            },
          },
        },
      });

      prefixReportsDirectoryWithProjectRoot(tree);

      expect(
        readProjectConfiguration(tree, 'lib-a').targets.test.options
          .reportsDirectory
      ).toBe('{projectRoot}/coverage/libs/lib-a');
      expect(
        readProjectConfiguration(tree, 'lib-b').targets.test.options
          .reportsDirectory
      ).toBe('{projectRoot}/coverage/libs/lib-b');
    });
  });

  describe('targetDefaults migration', () => {
    it('should migrate reportsDirectory in executor-keyed targetDefaults', () => {
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults = {
        '@nx/vitest:test': {
          options: {
            reportsDirectory: 'coverage',
          },
        },
      };
      updateNxJson(tree, nxJson);

      prefixReportsDirectoryWithProjectRoot(tree);

      const updatedNxJson = readNxJson(tree);
      expect(
        updatedNxJson.targetDefaults['@nx/vitest:test'].options.reportsDirectory
      ).toBe('{projectRoot}/coverage');
    });

    it('should migrate reportsDirectory in target-name-keyed targetDefaults', () => {
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults = {
        test: {
          executor: '@nx/vitest:test',
          options: {
            reportsDirectory: 'coverage',
          },
        },
      };
      updateNxJson(tree, nxJson);

      prefixReportsDirectoryWithProjectRoot(tree);

      const updatedNxJson = readNxJson(tree);
      expect(updatedNxJson.targetDefaults.test.options.reportsDirectory).toBe(
        '{projectRoot}/coverage'
      );
    });

    it('should not modify targetDefaults for unrelated executors', () => {
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults = {
        '@nx/jest:jest': {
          options: {
            reportsDirectory: 'coverage',
          },
        },
      };
      updateNxJson(tree, nxJson);

      prefixReportsDirectoryWithProjectRoot(tree);

      const updatedNxJson = readNxJson(tree);
      expect(
        updatedNxJson.targetDefaults['@nx/jest:jest'].options.reportsDirectory
      ).toBe('coverage');
    });

    it('should handle workspace without targetDefaults', () => {
      const nxJson = readNxJson(tree);
      delete nxJson.targetDefaults;
      updateNxJson(tree, nxJson);

      // Should not throw
      prefixReportsDirectoryWithProjectRoot(tree);

      const updatedNxJson = readNxJson(tree);
      expect(updatedNxJson.targetDefaults).toBeUndefined();
    });
  });

  describe('no-op scenarios', () => {
    it('should handle empty workspace', () => {
      // Should not throw
      prefixReportsDirectoryWithProjectRoot(tree);
    });
  });
});
