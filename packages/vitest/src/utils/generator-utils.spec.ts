import {
  addProjectConfiguration,
  readNxJson,
  readProjectConfiguration,
  Tree,
  updateNxJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  addOrChangeTestTarget,
  createOrEditViteConfig,
} from './generator-utils';

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
    it('should escape special characters in testInclude patterns', () => {
      createOrEditViteConfig(
        tree,
        {
          project: 'my-app',
          includeVitest: true,
          coverageProvider: 'none',
          testInclude: ["specs/it's.spec.ts", 'src\\new.spec.ts'],
        },
        true,
        { vitestFileName: true, skipPackageJson: true }
      );

      const config = tree.read('apps/my-app/vitest.config.ts', 'utf-8');

      expect(config).toContain(
        `include: ['specs/it\\'s.spec.ts', 'src\\\\new.spec.ts'],`
      );
    });

    it('should escape line terminators in emitted literals', () => {
      createOrEditViteConfig(
        tree,
        {
          project: 'my-app',
          includeVitest: true,
          coverageProvider: 'none',
          testInclude: ['specs/a\nb.spec.ts'],
        },
        true,
        { vitestFileName: true, skipPackageJson: true }
      );

      const config = tree.read('apps/my-app/vitest.config.ts', 'utf-8');

      expect(config).toContain(`include: ['specs/a\\nb.spec.ts'],`);
    });

    it('should emit resolve.alias entries for resolveAlias', () => {
      createOrEditViteConfig(
        tree,
        {
          project: 'my-app',
          includeVitest: true,
          coverageProvider: 'none',
          resolveAlias: {
            '@': './src',
            '@proj/lib': '../../libs/lib/src/index.ts',
          },
        },
        true,
        { vitestFileName: true, skipPackageJson: true }
      );

      const config = tree.read('apps/my-app/vitest.config.ts', 'utf-8');

      expect(config).toContain(`import { join } from 'node:path';`);
      expect(config).toContain(`'@': join(import.meta.dirname, './src'),`);
      expect(config).toContain(
        `'@proj/lib': join(import.meta.dirname, '../../libs/lib/src/index.ts'),`
      );
    });

    it('should not add resolve.alias to an existing config', () => {
      tree.write('apps/my-app/vitest.config.ts', 'export default {};');

      createOrEditViteConfig(
        tree,
        {
          project: 'my-app',
          includeVitest: true,
          coverageProvider: 'none',
          resolveAlias: { '@': './src' },
        },
        true,
        { vitestFileName: true, skipPackageJson: true }
      );

      const config = tree.read('apps/my-app/vitest.config.ts', 'utf-8');

      expect(config).not.toContain('alias');
      expect(config).not.toContain('node:path');
    });

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

describe('addOrChangeTestTarget', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'my-app-e2e', {
      root: 'apps/my-app-e2e',
      sourceRoot: 'apps/my-app-e2e/src',
      projectType: 'application',
    });
  });

  function registerVitestPlugin(options?: Record<string, string>) {
    const nxJson = readNxJson(tree);
    nxJson.plugins = [
      options ? { plugin: '@nx/vitest', options } : '@nx/vitest',
    ];
    updateNxJson(tree, nxJson);
  }

  function targetsOf(project: string) {
    return readProjectConfiguration(tree, project).targets ?? {};
  }

  it('should add the requested target when the plugin infers a different name', () => {
    registerVitestPlugin();

    addOrChangeTestTarget(
      tree,
      { project: 'my-app-e2e', testTarget: 'e2e', coverageProvider: 'none' },
      false
    );

    expect(targetsOf('my-app-e2e').e2e).toEqual({
      executor: '@nx/vitest:test',
      outputs: ['{options.reportsDirectory}'],
      options: { reportsDirectory: 'coverage/apps/my-app-e2e' },
    });
  });

  it('should not add a target when the plugin infers the requested name', () => {
    registerVitestPlugin();

    addOrChangeTestTarget(
      tree,
      { project: 'my-app-e2e', coverageProvider: 'none' },
      false
    );

    expect(targetsOf('my-app-e2e').test).toBeUndefined();
  });

  it('should match the requested target against the plugin testTargetName', () => {
    registerVitestPlugin({ testTargetName: 'e2e' });

    addOrChangeTestTarget(
      tree,
      { project: 'my-app-e2e', testTarget: 'e2e', coverageProvider: 'none' },
      false
    );

    expect(targetsOf('my-app-e2e').e2e).toBeUndefined();
  });

  it('should match the requested target against the plugin ciTargetName', () => {
    registerVitestPlugin({ ciTargetName: 'e2e-ci' });

    addOrChangeTestTarget(
      tree,
      { project: 'my-app-e2e', testTarget: 'e2e-ci', coverageProvider: 'none' },
      false
    );

    expect(targetsOf('my-app-e2e')['e2e-ci']).toBeUndefined();
  });

  it('should keep the caller verdict when nx.json registers no plugins', () => {
    addOrChangeTestTarget(
      tree,
      { project: 'my-app-e2e', coverageProvider: 'none' },
      true
    );

    expect(targetsOf('my-app-e2e').test).toBeUndefined();
  });
});
