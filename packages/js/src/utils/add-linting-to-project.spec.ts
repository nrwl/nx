import '@nx/devkit/internal-testing-utils/mock-project-graph';

import {
  addProjectConfiguration,
  readJson,
  readNxJson,
  Tree,
  updateJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { addLintingToProject } from './add-linting-to-project';

/**
 * Every framework generator that offers a linter routes through this helper, so
 * this is the one place the `oxlint` arm can be covered once rather than per
 * framework.
 */
describe('addLintingToProject', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'my-lib', {
      root: 'libs/my-lib',
      sourceRoot: 'libs/my-lib/src',
      projectType: 'library',
      targets: {},
    });
  });

  it('registers oxlint when asked for it', async () => {
    await addLintingToProject(tree, {
      linter: 'oxlint',
      project: 'my-lib',
      addPlugin: true,
    });

    const { devDependencies } = readJson(tree, 'package.json');
    expect(devDependencies['oxlint']).toBeDefined();
    expect(devDependencies['@nx/oxlint']).toBeDefined();

    const plugins = readNxJson(tree).plugins?.map((p) =>
      typeof p === 'string' ? p : p.plugin
    );
    expect(plugins).toContain('@nx/oxlint');
    expect(tree.exists('.oxlintrc.json')).toBe(true);
  });

  it('does not pull in eslint when oxlint is requested', async () => {
    await addLintingToProject(tree, {
      linter: 'oxlint',
      project: 'my-lib',
      addPlugin: true,
    });

    const { devDependencies } = readJson(tree, 'package.json');
    expect(devDependencies['eslint']).toBeUndefined();
    expect(devDependencies['@nx/eslint']).toBeUndefined();
  });

  // `undefined` reaches the dispatcher from callers whose schema declares
  // `linter?`. The exhaustiveness check added alongside the normalization must
  // not turn that into a throw.
  it('falls back to eslint when the workspace already uses it', async () => {
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies = { ...json.devDependencies, eslint: '^9.0.0' };
      return json;
    });

    await expect(
      addLintingToProject(tree, {
        linter: undefined,
        project: 'my-lib',
        addPlugin: true,
      })
    ).resolves.toBeDefined();

    const { devDependencies } = readJson(tree, 'package.json');
    expect(devDependencies['@nx/eslint']).toBeDefined();
    expect(devDependencies['oxlint']).toBeUndefined();
  });

  // Detection now answers `none` for a workspace with no linter, so the
  // dispatcher must set nothing up rather than inferring ESLint.
  it('sets nothing up when the workspace has no linter', async () => {
    await expect(
      addLintingToProject(tree, {
        linter: undefined,
        project: 'my-lib',
        addPlugin: true,
      })
    ).resolves.toBeDefined();

    const { devDependencies = {} } = readJson(tree, 'package.json');
    expect(devDependencies['@nx/eslint']).toBeUndefined();
    expect(devDependencies['oxlint']).toBeUndefined();
  });

  // The other half of the same fallback: a caller that does not resolve the
  // linter must not silently get ESLint in a workspace that uses Oxlint.
  it('falls back to oxlint when the workspace already uses it', async () => {
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies = { ...json.devDependencies, oxlint: '^1.43.0' };
      return json;
    });

    await addLintingToProject(tree, {
      linter: undefined,
      project: 'my-lib',
      addPlugin: true,
    });

    const { devDependencies } = readJson(tree, 'package.json');
    expect(devDependencies['@nx/oxlint']).toBeDefined();
    expect(devDependencies['@nx/eslint']).toBeUndefined();
  });

  // The plugin names come from the runner packages, so these also assert that
  // `@nx/jest` and `@nx/vitest` are reachable through `ensurePackage` here.
  it.each([
    ['jest', 'jest'],
    ['vitest', 'vitest'],
    // Angular ships a suffixed runner; it still needs the vitest plugin.
    ['vitest-analog', 'vitest'],
  ])('enables the oxlint %s plugin for %s', async (unitTestRunner, plugin) => {
    await addLintingToProject(tree, {
      linter: 'oxlint',
      project: 'my-lib',
      addPlugin: true,
      unitTestRunner,
    });

    expect(readJson(tree, 'libs/my-lib/.oxlintrc.json').plugins).toContain(
      plugin
    );
  });

  it('enables no test plugin when there is no unit test runner', async () => {
    await addLintingToProject(tree, {
      linter: 'oxlint',
      project: 'my-lib',
      addPlugin: true,
      unitTestRunner: 'none',
    });

    // With no plugins to add, the generator writes no project config at all.
    expect(tree.exists('libs/my-lib/.oxlintrc.json')).toBe(false);
  });

  // How every framework generator hands Oxlint its presets — react, next, vue,
  // nuxt, remix, react-native and expo all pass one.
  it('enables the framework plugins the caller asks for', async () => {
    await addLintingToProject(tree, {
      linter: 'oxlint',
      project: 'my-lib',
      addPlugin: true,
      oxlintPlugins: ['react', 'jsx-a11y'],
      unitTestRunner: 'jest',
    });

    expect(readJson(tree, 'libs/my-lib/.oxlintrc.json').plugins).toEqual(
      expect.arrayContaining(['react', 'jsx-a11y', 'jest'])
    );
  });

  it('configures nothing for none', async () => {
    await addLintingToProject(tree, {
      linter: 'none',
      project: 'my-lib',
      addPlugin: true,
    });

    const { devDependencies = {} } = readJson(tree, 'package.json');
    expect(devDependencies['oxlint']).toBeUndefined();
    expect(devDependencies['eslint']).toBeUndefined();
    expect(tree.exists('.oxlintrc.json')).toBe(false);
  });
});
