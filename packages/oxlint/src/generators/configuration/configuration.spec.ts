import '@nx/devkit/internal-testing-utils/mock-project-graph';

import {
  addProjectConfiguration,
  readJson,
  readNxJson,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { configurationGenerator } from './configuration.js';

describe('configurationGenerator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'lib-a', {
      root: 'libs/lib-a',
      sourceRoot: 'libs/lib-a/src',
      projectType: 'library',
      targets: {},
    });
  });

  it('registers the plugin', async () => {
    await configurationGenerator(tree, {
      project: 'lib-a',
      skipPackageJson: true,
      skipFormat: true,
    });

    const plugins = readNxJson(tree).plugins?.map((p) =>
      typeof p === 'string' ? p : p.plugin
    );
    expect(plugins).toContain('@nx/oxlint');
  });

  // The inference-only invariant. Writing a target here would produce a second
  // way to run Oxlint that has to be kept in sync with the inferred one.
  it('writes no target', async () => {
    await configurationGenerator(tree, {
      project: 'lib-a',
      skipPackageJson: true,
      skipFormat: true,
    });

    expect(readProjectConfiguration(tree, 'lib-a').targets).toEqual({});
  });

  it("enables the project's plugins in its own config", async () => {
    await configurationGenerator(tree, {
      project: 'lib-a',
      plugins: ['react', 'jsx-a11y'],
      skipPackageJson: true,
      skipFormat: true,
    });

    expect(readJson(tree, 'libs/lib-a/.oxlintrc.json')).toMatchObject({
      extends: ['../../.oxlintrc.json'],
      plugins: ['react', 'jsx-a11y'],
    });
  });

  it('writes no project config when no plugins are requested', async () => {
    await configurationGenerator(tree, {
      project: 'lib-a',
      skipPackageJson: true,
      skipFormat: true,
    });

    expect(tree.exists('libs/lib-a/.oxlintrc.json')).toBe(false);
  });

  it('is idempotent', async () => {
    const options = {
      project: 'lib-a',
      plugins: ['react'],
      skipPackageJson: true,
      skipFormat: true,
    };
    await configurationGenerator(tree, options);
    await configurationGenerator(tree, options);

    const plugins = readNxJson(tree).plugins?.filter((p) =>
      typeof p === 'string' ? p === '@nx/oxlint' : p.plugin === '@nx/oxlint'
    );
    expect(plugins).toHaveLength(1);
    expect(readJson(tree, 'libs/lib-a/.oxlintrc.json').plugins).toEqual([
      'react',
    ]);
  });

  // `plugins` defaults to `[]`, so gating the project read on it would make a
  // typo'd `--project` exit 0 having registered the plugin workspace-wide. No
  // other test here passes an unknown project.
  it('fails on an unknown project', async () => {
    await expect(
      configurationGenerator(tree, {
        project: 'lib-typo',
        skipPackageJson: true,
        skipFormat: true,
      })
    ).rejects.toThrow(/lib-typo/);
  });
});
