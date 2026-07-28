import { readJson, readNxJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { initGeneratorInternal } from './init.js';

describe('initGeneratorInternal', () => {
  it('adds a root oxlint config matching what `oxlint --init` scaffolds', async () => {
    const tree = createTreeWithEmptyWorkspace();

    await initGeneratorInternal(tree, {
      addPlugin: false,
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

  it('sets targetDefaults when the plugin is disabled', async () => {
    const tree = createTreeWithEmptyWorkspace();

    await initGeneratorInternal(tree, {
      addPlugin: false,
      skipPackageJson: true,
      skipFormat: true,
    });

    const nxJson = readNxJson(tree);
    expect(nxJson.targetDefaults['@nx/oxlint:lint']).toMatchObject({
      cache: true,
    });
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
      addPlugin: false,
      skipPackageJson: true,
      skipFormat: true,
    });

    expect(tree.read(configFile, 'utf-8')).toEqual('{}');
    if (configFile !== '.oxlintrc.json') {
      expect(tree.exists('.oxlintrc.json')).toBe(false);
    }
  });
});
