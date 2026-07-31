import 'nx/src/internal-testing-utils/mock-project-graph';

import {
  createProjectGraphAsync,
  readJson,
  readNxJson,
  updateNxJson,
  writeJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { initGeneratorInternal } from './init.js';

describe('initGeneratorInternal', () => {
  it('adds a root oxlint config matching what `oxlint --init` scaffolds', async () => {
    const tree = createTreeWithEmptyWorkspace();

    await initGeneratorInternal(tree, {
      skipPackageJson: true,
      skipFormat: true,
    });

    expect(readJson(tree, '.oxlintrc.json')).toEqual({
      // Resolved from node_modules so it tracks the installed version.
      $schema: './node_modules/oxlint/configuration_schema.json',
      plugins: ['typescript', 'unicorn', 'oxc'],
      categories: { correctness: 'error' },
      rules: {},
      env: { builtin: true },
    });
  });

  it('recommends the Oxc VS Code extension when recommendations already exist', async () => {
    const tree = createTreeWithEmptyWorkspace();
    writeJson(tree, '.vscode/extensions.json', {
      recommendations: ['esbenp.prettier-vscode'],
    });

    await initGeneratorInternal(tree, {
      skipPackageJson: true,
      skipFormat: true,
    });

    expect(readJson(tree, '.vscode/extensions.json').recommendations).toEqual([
      'esbenp.prettier-vscode',
      'oxc.oxc-vscode',
    ]);
  });

  it('does not create .vscode/extensions.json when absent', async () => {
    const tree = createTreeWithEmptyWorkspace();

    await initGeneratorInternal(tree, {
      skipPackageJson: true,
      skipFormat: true,
    });

    expect(tree.exists('.vscode/extensions.json')).toBe(false);
  });

  // Registered even though this workspace opted out of inference plugins:
  // `@nx/oxlint` has no other way to produce a task, so honouring the opt-out
  // would mean doing nothing at all.
  it('registers the plugin even when useInferencePlugins is false', async () => {
    const tree = createTreeWithEmptyWorkspace();
    updateNxJson(tree, { ...readNxJson(tree), useInferencePlugins: false });

    await initGeneratorInternal(tree, {
      skipPackageJson: true,
      skipFormat: true,
    });

    const plugins = readNxJson(tree).plugins?.map((p) =>
      typeof p === 'string' ? p : p.plugin
    );
    expect(plugins).toContain('@nx/oxlint');
    expect(
      readNxJson(tree).targetDefaults?.['@nx/oxlint:lint']
    ).toBeUndefined();
  });

  // `addPlugin` resolves the target name by running our own `createNodes`
  // against the real filesystem, where the root config does not exist yet on a
  // first install because the Tree has not been flushed. It would therefore see
  // no conflicts and take `lint`, even where ESLint already owns it. The
  // candidate list is pre-filtered against the existing graph to prevent that.
  it('should step aside when another linter already owns lint', async () => {
    const tree = createTreeWithEmptyWorkspace();
    (createProjectGraphAsync as jest.Mock).mockResolvedValueOnce({
      nodes: {
        'lib-a': {
          name: 'lib-a',
          type: 'lib',
          data: {
            root: 'libs/lib-a',
            targets: { lint: { executor: '@nx/eslint:lint' } },
          },
        },
      },
      dependencies: {},
    });

    await initGeneratorInternal(tree, {
      skipPackageJson: true,
      skipFormat: true,
    });

    const plugin = readNxJson(tree).plugins?.find((p) =>
      typeof p === 'string' ? false : p.plugin === '@nx/oxlint'
    ) as { plugin: string; options?: { targetName?: string } };
    expect(plugin.options?.targetName).toBe('oxlint');
  });

  it.each([
    '.oxlintrc.json',
    '.oxlintrc.jsonc',
    'oxlint.config.ts',
    'oxlint.config.mts',
  ])('does not overwrite an existing %s', async (configFile) => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write(configFile, '{}');

    await initGeneratorInternal(tree, {
      skipPackageJson: true,
      skipFormat: true,
    });

    expect(tree.read(configFile, 'utf-8')).toEqual('{}');
    if (configFile !== '.oxlintrc.json') {
      expect(tree.exists('.oxlintrc.json')).toBe(false);
    }
  });
});
