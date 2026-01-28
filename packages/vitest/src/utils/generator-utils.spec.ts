import { addProjectConfiguration, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { createOrEditViteConfig } from './generator-utils';

jest.mock('@nx/js/src/utils/typescript/ts-solution-setup', () => ({
  isUsingTsSolutionSetup: jest.fn(() => false),
}));

describe('createOrEditViteConfig', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'my-app', {
      root: 'apps/my-app',
      sourceRoot: 'apps/my-app/src',
      projectType: 'application',
    });
  });

  describe('vitest config generation', () => {
    it('should generate vitest config with v8 coverage provider', () => {
      createOrEditViteConfig(
        tree,
        {
          project: 'my-app',
          includeVitest: true,
          coverageProvider: 'v8',
          testEnvironment: 'node',
        },
        true,
        { vitestFileName: true, skipPackageJson: true }
      );

      const config = tree.read('apps/my-app/vitest.config.ts', 'utf-8');

      expect(config).toMatchSnapshot();
    });

    it('should generate vitest config with istanbul coverage provider', () => {
      createOrEditViteConfig(
        tree,
        {
          project: 'my-app',
          includeVitest: true,
          coverageProvider: 'istanbul',
          testEnvironment: 'jsdom',
        },
        true,
        { vitestFileName: true, skipPackageJson: true }
      );

      const config = tree.read('apps/my-app/vitest.config.ts', 'utf-8');

      expect(config).toMatchSnapshot();
    });

    it('should generate vitest config without coverage when coverageProvider is none', () => {
      createOrEditViteConfig(
        tree,
        {
          project: 'my-app',
          includeVitest: true,
          coverageProvider: 'none',
          testEnvironment: 'node',
        },
        true,
        { vitestFileName: true, skipPackageJson: true }
      );

      const config = tree.read('apps/my-app/vitest.config.ts', 'utf-8');

      expect(config).toMatchSnapshot();
    });

    it('should generate valid JavaScript syntax for all coverage provider options', () => {
      const coverageProviders = ['v8', 'istanbul', 'custom', 'none'] as const;

      for (const provider of coverageProviders) {
        const testTree = createTreeWithEmptyWorkspace();
        addProjectConfiguration(testTree, 'test-project', {
          root: 'apps/test-project',
          sourceRoot: 'apps/test-project/src',
          projectType: 'application',
        });

        createOrEditViteConfig(
          testTree,
          {
            project: 'test-project',
            includeVitest: true,
            coverageProvider: provider,
            testEnvironment: 'node',
          },
          true,
          { vitestFileName: true, skipPackageJson: true }
        );

        const config = testTree.read(
          'apps/test-project/vitest.config.ts',
          'utf-8'
        );

        expect(config).toMatchSnapshot();
      }
    });

    it('should use .mts extension when useEsmExtension is true', () => {
      createOrEditViteConfig(
        tree,
        {
          project: 'my-app',
          includeVitest: true,
          coverageProvider: 'v8',
          testEnvironment: 'node',
          useEsmExtension: true,
        },
        true,
        { vitestFileName: true, skipPackageJson: true }
      );

      expect(tree.exists('apps/my-app/vitest.config.mts')).toBe(true);
      expect(tree.exists('apps/my-app/vitest.config.ts')).toBe(false);
    });

    it('should include setupFiles when setupFile option is provided', () => {
      createOrEditViteConfig(
        tree,
        {
          project: 'my-app',
          includeVitest: true,
          coverageProvider: 'v8',
          testEnvironment: 'node',
          setupFile: './src/test-setup.ts',
        },
        true,
        { vitestFileName: true, skipPackageJson: true }
      );

      const config = tree.read('apps/my-app/vitest.config.ts', 'utf-8');

      expect(config).toMatchSnapshot();
    });

    it('should include includeSource when inSourceTests is true', () => {
      createOrEditViteConfig(
        tree,
        {
          project: 'my-app',
          includeVitest: true,
          coverageProvider: 'v8',
          testEnvironment: 'node',
          inSourceTests: true,
        },
        true,
        { vitestFileName: true, skipPackageJson: true }
      );

      const config = tree.read('apps/my-app/vitest.config.ts', 'utf-8');

      expect(config).toMatchSnapshot();
    });
  });

  describe('vite config generation (not vitest-only)', () => {
    it('should generate vite.config.ts with vitest reference when not onlyVitest', () => {
      createOrEditViteConfig(
        tree,
        {
          project: 'my-app',
          includeVitest: true,
          coverageProvider: 'v8',
          testEnvironment: 'node',
        },
        false,
        { skipPackageJson: true }
      );

      const config = tree.read('apps/my-app/vite.config.ts', 'utf-8');

      expect(config).toMatchSnapshot();
    });

    it('should include library build config when includeLib is true', () => {
      addProjectConfiguration(tree, 'my-lib', {
        root: 'libs/my-lib',
        sourceRoot: 'libs/my-lib/src',
        projectType: 'library',
      });

      createOrEditViteConfig(
        tree,
        {
          project: 'my-lib',
          includeVitest: true,
          includeLib: true,
          coverageProvider: 'v8',
          testEnvironment: 'node',
        },
        false,
        { skipPackageJson: true }
      );

      const config = tree.read('libs/my-lib/vite.config.ts', 'utf-8');

      expect(config).toMatchSnapshot();
    });
  });

  describe('test environment options', () => {
    it.each(['node', 'jsdom', 'happy-dom', 'edge-runtime'] as const)(
      'should set test environment to %s',
      (env) => {
        createOrEditViteConfig(
          tree,
          {
            project: 'my-app',
            includeVitest: true,
            coverageProvider: 'v8',
            testEnvironment: env,
          },
          true,
          { vitestFileName: true, skipPackageJson: true }
        );

        const config = tree.read('apps/my-app/vitest.config.ts', 'utf-8');

        expect(config).toMatchSnapshot();
      }
    );

    it('should default to jsdom when testEnvironment is not specified', () => {
      createOrEditViteConfig(
        tree,
        {
          project: 'my-app',
          includeVitest: true,
          coverageProvider: 'v8',
        },
        true,
        { vitestFileName: true, skipPackageJson: true }
      );

      const config = tree.read('apps/my-app/vitest.config.ts', 'utf-8');

      expect(config).toMatchSnapshot();
    });
  });
});
