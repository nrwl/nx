import {
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nrwl/devkit';
import { createTreeWithEmptyV1Workspace } from '@nrwl/devkit/testing';
import { tsquery } from '@phenomnomnominal/tsquery';
import {
  ensureBuildOptionsInViteConfig,
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

  describe('ensureBuildOptionsInViteConfig', () => {
    let tree: Tree;

    const buildOption = `
    // Configuration for building your library.
    // See: https://vitejs.dev/guide/build.html#library-mode
    build: {
      lib: {
        // Could also be a dictionary or array of multiple entry points.
        entry: 'src/index.ts',
        name: 'my-app',
        fileName: 'index',
        // Change this to the formats you want to support.
        // Don't forgot to update your package.json as well.
        formats: ['es', 'cjs']
      },
      rollupOptions: {
        // External packages that should not be bundled into your library.
        external: ["'react', 'react-dom', 'react/jsx-runtime'"]
      }
    },`;

    const buildOptionObject = {
      lib: {
        entry: 'src/index.ts',
        name: 'my-app',
        fileName: 'index',
        formats: ['es', 'cjs'],
      },
      rollupOptions: {
        external: ["'react', 'react-dom', 'react/jsx-runtime'"],
      },
    };

    const noBuildOptions = `
    import { defineConfig } from 'vite';
    import react from '@vitejs/plugin-react';
    import viteTsConfigPaths from 'vite-tsconfig-paths';

    export default defineConfig({
      server: {
        port: 4200,
        host: 'localhost',
      },
      plugins: [
        react(),
        viteTsConfigPaths({
          root: '../../',
        }),
      ],

      test: {
        globals: true,
        cache: {
          dir: '../../node_modules/.vitest',
        },
        environment: 'jsdom',
        include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
      },

    });
    `;

    const someBuildOptions = `
    import { defineConfig } from 'vite';
    import react from '@vitejs/plugin-react';
    import viteTsConfigPaths from 'vite-tsconfig-paths';

    export default defineConfig({
      server: {
        port: 4200,
        host: 'localhost',
      },
      plugins: [
        react(),
        viteTsConfigPaths({
          root: '../../',
        }),
      ],

      test: {
        globals: true,
        cache: {
          dir: '../../node_modules/.vitest',
        },
        environment: 'jsdom',
        include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
      },

      build: {
        my: 'option',
      }

    });
    `;

    const noContentDefineConfig = `
    import { defineConfig } from 'vite';
    import react from '@vitejs/plugin-react';
    import viteTsConfigPaths from 'vite-tsconfig-paths';

    export default defineConfig({});
    `;

    const conditionalConfig = `
    import { defineConfig } from 'vite';
    export default defineConfig(({ command, mode, ssrBuild }) => {
      if (command === 'serve') {
        return {
          port: 4200,
          host: 'localhost',
        }
      } else {
        // command === 'build'
        return {
          my: 'option',
        }
      }
    })
    `;

    const configNoDefineConfig = `
    import { defineConfig } from 'vite';
    import react from '@vitejs/plugin-react';
    import viteTsConfigPaths from 'vite-tsconfig-paths';

    export default {
      server: {
        port: 4200,
        host: 'localhost',
      },
      plugins: [
        react(),
        viteTsConfigPaths({
          root: '../../',
        }),
      ],
    };
    `;

    beforeEach(() => {
      tree = createTreeWithEmptyV1Workspace();
    });

    it("should add build options if build options don't exist", () => {
      tree.write('apps/my-app/vite.config.ts', noBuildOptions);
      ensureBuildOptionsInViteConfig(
        tree,
        'apps/my-app/vite.config.ts',
        buildOption,
        buildOptionObject
      );
      const appFileContent = tree.read('apps/my-app/vite.config.ts', 'utf-8');
      const file = tsquery.ast(appFileContent);
      const buildNode = tsquery.query(
        file,
        'PropertyAssignment:has(Identifier[name="build"])'
      );
      expect(buildNode).toBeDefined();
      expect(appFileContent).toMatchSnapshot();
    });

    it('should add new build options if some build options already exist', () => {
      tree.write('apps/my-app/vite.config.ts', someBuildOptions);
      ensureBuildOptionsInViteConfig(
        tree,
        'apps/my-app/vite.config.ts',
        buildOption,
        buildOptionObject
      );
      const appFileContent = tree.read('apps/my-app/vite.config.ts', 'utf-8');
      const file = tsquery.ast(appFileContent);
      const buildNode = tsquery.query(
        file,
        'PropertyAssignment:has(Identifier[name="build"])'
      );
      expect(buildNode).toBeDefined();
      expect(appFileContent).toMatchSnapshot();
    });

    it('should add build options if defineConfig is empty', () => {
      tree.write('apps/my-app/vite.config.ts', noContentDefineConfig);
      ensureBuildOptionsInViteConfig(
        tree,
        'apps/my-app/vite.config.ts',
        buildOption,
        buildOptionObject
      );
      const appFileContent = tree.read('apps/my-app/vite.config.ts', 'utf-8');
      const file = tsquery.ast(appFileContent);
      const buildNode = tsquery.query(
        file,
        'PropertyAssignment:has(Identifier[name="build"])'
      );
      expect(buildNode).toBeDefined();
      expect(appFileContent).toMatchSnapshot();
    });

    it('should add build options if it is using conditional config', () => {
      tree.write('apps/my-app/vite.config.ts', conditionalConfig);
      ensureBuildOptionsInViteConfig(
        tree,
        'apps/my-app/vite.config.ts',
        buildOption,
        buildOptionObject
      );
      const appFileContent = tree.read('apps/my-app/vite.config.ts', 'utf-8');
      const file = tsquery.ast(appFileContent);
      const buildNode = tsquery.query(
        file,
        'PropertyAssignment:has(Identifier[name="build"])'
      );
      expect(buildNode).toBeDefined();
      expect(appFileContent).toMatchSnapshot();
    });

    it('should add build options if defineConfig is not used', () => {
      tree.write('apps/my-app/vite.config.ts', configNoDefineConfig);
      ensureBuildOptionsInViteConfig(
        tree,
        'apps/my-app/vite.config.ts',
        buildOption,
        buildOptionObject
      );
      const appFileContent = tree.read('apps/my-app/vite.config.ts', 'utf-8');
      const file = tsquery.ast(appFileContent);
      const buildNode = tsquery.query(
        file,
        'PropertyAssignment:has(Identifier[name="build"])'
      );
      expect(buildNode).toBeDefined();
      expect(appFileContent).toMatchSnapshot();
    });

    it('should not do anything if cannot understand syntax of vite config', () => {
      tree.write('apps/my-app/vite.config.ts', `console.log('Unknown syntax')`);
      ensureBuildOptionsInViteConfig(
        tree,
        'apps/my-app/vite.config.ts',
        buildOption,
        buildOptionObject
      );
      const appFileContent = tree.read('apps/my-app/vite.config.ts', 'utf-8');
      expect(appFileContent).toMatchSnapshot();
    });
  });
});
