import { type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import removeDeprecatedOptions from './remove-deprecated-options';

describe('remove-deprecated-options', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  describe('deleteOutputPath option', () => {
    it('should remove deleteOutputPath from project.json options', async () => {
      // ARRANGE
      tree.write(
        'apps/test-app/project.json',
        JSON.stringify({
          name: 'test-app',
          root: 'apps/test-app',
          sourceRoot: 'apps/test-app/src',
          projectType: 'application',
          targets: {
            build: {
              executor: '@nx/rspack:rspack',
              options: {
                outputPath: 'dist/apps/test-app',
                main: 'apps/test-app/src/main.ts',
                deleteOutputPath: true,
                tsConfig: 'apps/test-app/tsconfig.app.json',
              },
            },
          },
        })
      );

      // ACT
      await removeDeprecatedOptions(tree);

      // ASSERT
      const projectJson = JSON.parse(
        tree.read('apps/test-app/project.json', 'utf-8')
      );
      expect(
        projectJson.targets.build.options.deleteOutputPath
      ).toBeUndefined();
      expect(projectJson.targets.build.options.outputPath).toBe(
        'dist/apps/test-app'
      );
      expect(projectJson.targets.build.options.main).toBe(
        'apps/test-app/src/main.ts'
      );
    });

    it('should remove deleteOutputPath from project.json configurations', async () => {
      // ARRANGE
      tree.write(
        'apps/test-app/project.json',
        JSON.stringify({
          name: 'test-app',
          root: 'apps/test-app',
          sourceRoot: 'apps/test-app/src',
          projectType: 'application',
          targets: {
            build: {
              executor: '@nx/rspack:rspack',
              options: {
                outputPath: 'dist/apps/test-app',
                main: 'apps/test-app/src/main.ts',
              },
              configurations: {
                production: {
                  deleteOutputPath: false,
                  optimization: true,
                },
              },
            },
          },
        })
      );

      // ACT
      await removeDeprecatedOptions(tree);

      // ASSERT
      const projectJson = JSON.parse(
        tree.read('apps/test-app/project.json', 'utf-8')
      );
      expect(
        projectJson.targets.build.configurations.production.deleteOutputPath
      ).toBeUndefined();
      expect(
        projectJson.targets.build.configurations.production.optimization
      ).toBe(true);
    });

    it('should add comment when removing from rspack config files', async () => {
      // ARRANGE
      tree.write(
        'apps/test-app/project.json',
        JSON.stringify({
          name: 'test-app',
          root: 'apps/test-app',
          sourceRoot: 'apps/test-app/src',
          projectType: 'application',
          targets: {
            build: {
              executor: '@nx/rspack:rspack',
              options: {},
            },
          },
        })
      );
      tree.write(
        'apps/test-app/rspack.config.ts',
        `export default {
  entry: './src/main.ts',
  deleteOutputPath: true,
  output: {
    path: 'dist',
  },
};`
      );

      // ACT
      await removeDeprecatedOptions(tree);

      // ASSERT
      const configContent = tree.read(
        'apps/test-app/rspack.config.ts',
        'utf-8'
      );
      expect(configContent).toMatchInlineSnapshot(`
        "export default {
          entry: './src/main.ts',
          // deleteOutputPath option has been removed in Nx v22. Use output.clean in your Rspack config instead,
          output: {
            path: 'dist',
          },
        };
        "
      `);
      expect(configContent).not.toContain('deleteOutputPath: true');
    });
  });

  describe('sassImplementation option', () => {
    it('should remove sassImplementation from project.json options', async () => {
      // ARRANGE
      tree.write(
        'apps/test-app/project.json',
        JSON.stringify({
          name: 'test-app',
          root: 'apps/test-app',
          sourceRoot: 'apps/test-app/src',
          projectType: 'application',
          targets: {
            build: {
              executor: '@nx/rspack:rspack',
              options: {
                outputPath: 'dist/apps/test-app',
                main: 'apps/test-app/src/main.ts',
                sassImplementation: 'sass-embedded',
                tsConfig: 'apps/test-app/tsconfig.app.json',
              },
            },
          },
        })
      );

      // ACT
      await removeDeprecatedOptions(tree);

      // ASSERT
      const projectJson = JSON.parse(
        tree.read('apps/test-app/project.json', 'utf-8')
      );
      expect(
        projectJson.targets.build.options.sassImplementation
      ).toBeUndefined();
      expect(projectJson.targets.build.options.outputPath).toBe(
        'dist/apps/test-app'
      );
    });

    it('should remove sassImplementation from configurations', async () => {
      // ARRANGE
      tree.write(
        'apps/test-app/project.json',
        JSON.stringify({
          name: 'test-app',
          root: 'apps/test-app',
          sourceRoot: 'apps/test-app/src',
          projectType: 'application',
          targets: {
            build: {
              executor: '@nx/rspack:rspack',
              options: {
                outputPath: 'dist/apps/test-app',
              },
              configurations: {
                production: {
                  sassImplementation: 'sass',
                  optimization: true,
                },
              },
            },
          },
        })
      );

      // ACT
      await removeDeprecatedOptions(tree);

      // ASSERT
      const projectJson = JSON.parse(
        tree.read('apps/test-app/project.json', 'utf-8')
      );
      expect(
        projectJson.targets.build.configurations.production.sassImplementation
      ).toBeUndefined();
      expect(
        projectJson.targets.build.configurations.production.optimization
      ).toBe(true);
    });

    it('should add comment when removing from rspack config files', async () => {
      // ARRANGE
      tree.write(
        'apps/test-app/project.json',
        JSON.stringify({
          name: 'test-app',
          root: 'apps/test-app',
          sourceRoot: 'apps/test-app/src',
          projectType: 'application',
          targets: {
            build: {
              executor: '@nx/rspack:rspack',
              options: {},
            },
          },
        })
      );
      tree.write(
        'apps/test-app/rspack.config.js',
        `module.exports = {
  entry: './src/main.ts',
  sassImplementation: 'sass-embedded',
  module: {
    rules: [],
  },
};`
      );

      // ACT
      await removeDeprecatedOptions(tree);

      // ASSERT
      const configContent = tree.read(
        'apps/test-app/rspack.config.js',
        'utf-8'
      );
      expect(configContent).toMatchInlineSnapshot(`
        "module.exports = {
          entry: './src/main.ts',
          // sassImplementation option has been removed in Nx v22. sass-embedded is now always used,
          module: {
            rules: [],
          },
        };
        "
      `);
      expect(configContent).not.toContain(
        "sassImplementation: 'sass-embedded'"
      );
    });
  });

  describe('both options together', () => {
    it('should remove both options from the same target', async () => {
      // ARRANGE
      tree.write(
        'apps/test-app/project.json',
        JSON.stringify({
          name: 'test-app',
          root: 'apps/test-app',
          sourceRoot: 'apps/test-app/src',
          projectType: 'application',
          targets: {
            build: {
              executor: '@nx/rspack:rspack',
              options: {
                outputPath: 'dist/apps/test-app',
                deleteOutputPath: true,
                sassImplementation: 'sass',
                main: 'apps/test-app/src/main.ts',
              },
            },
          },
        })
      );

      // ACT
      await removeDeprecatedOptions(tree);

      // ASSERT
      const projectJson = JSON.parse(
        tree.read('apps/test-app/project.json', 'utf-8')
      );
      expect(
        projectJson.targets.build.options.deleteOutputPath
      ).toBeUndefined();
      expect(
        projectJson.targets.build.options.sassImplementation
      ).toBeUndefined();
      expect(projectJson.targets.build.options.outputPath).toBe(
        'dist/apps/test-app'
      );
      expect(projectJson.targets.build.options.main).toBe(
        'apps/test-app/src/main.ts'
      );
    });
  });

  describe('idempotent', () => {
    it('should be safe to run multiple times', async () => {
      // ARRANGE
      tree.write(
        'apps/test-app/project.json',
        JSON.stringify({
          name: 'test-app',
          root: 'apps/test-app',
          sourceRoot: 'apps/test-app/src',
          projectType: 'application',
          targets: {
            build: {
              executor: '@nx/rspack:rspack',
              options: {
                outputPath: 'dist/apps/test-app',
                deleteOutputPath: true,
                sassImplementation: 'sass-embedded',
              },
            },
          },
        })
      );

      // ACT
      await removeDeprecatedOptions(tree);
      await removeDeprecatedOptions(tree);

      // ASSERT
      const projectJson = JSON.parse(
        tree.read('apps/test-app/project.json', 'utf-8')
      );
      expect(
        projectJson.targets.build.options.deleteOutputPath
      ).toBeUndefined();
      expect(
        projectJson.targets.build.options.sassImplementation
      ).toBeUndefined();
      expect(projectJson.targets.build.options.outputPath).toBe(
        'dist/apps/test-app'
      );
    });
  });

  describe('dev-server executor', () => {
    it('should also process @nx/rspack:dev-server executor', async () => {
      // ARRANGE
      tree.write(
        'apps/test-app/project.json',
        JSON.stringify({
          name: 'test-app',
          root: 'apps/test-app',
          sourceRoot: 'apps/test-app/src',
          projectType: 'application',
          targets: {
            serve: {
              executor: '@nx/rspack:dev-server',
              options: {
                buildTarget: 'test-app:build',
                deleteOutputPath: false,
                sassImplementation: 'sass',
              },
            },
          },
        })
      );

      // ACT
      await removeDeprecatedOptions(tree);

      // ASSERT
      const projectJson = JSON.parse(
        tree.read('apps/test-app/project.json', 'utf-8')
      );
      expect(
        projectJson.targets.serve.options.deleteOutputPath
      ).toBeUndefined();
      expect(
        projectJson.targets.serve.options.sassImplementation
      ).toBeUndefined();
      expect(projectJson.targets.serve.options.buildTarget).toBe(
        'test-app:build'
      );
    });
  });

  describe('no changes needed', () => {
    it('should not modify projects without deprecated options', async () => {
      // ARRANGE
      const originalContent = JSON.stringify(
        {
          name: 'test-app',
          root: 'apps/test-app',
          sourceRoot: 'apps/test-app/src',
          projectType: 'application',
          targets: {
            build: {
              executor: '@nx/rspack:rspack',
              options: {
                outputPath: 'dist/apps/test-app',
                main: 'apps/test-app/src/main.ts',
                tsConfig: 'apps/test-app/tsconfig.app.json',
              },
            },
          },
        },
        null,
        2
      );

      tree.write('apps/test-app/project.json', originalContent);

      // ACT
      await removeDeprecatedOptions(tree);

      // ASSERT
      const updatedContent = tree.read('apps/test-app/project.json', 'utf-8');
      const updatedJson = JSON.parse(updatedContent);
      const originalJson = JSON.parse(originalContent);
      expect(updatedJson).toEqual(originalJson);
    });
  });
});
