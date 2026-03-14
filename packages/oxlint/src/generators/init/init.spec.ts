import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { readNxJson } from '@nx/devkit';
import { initGeneratorInternal } from './init';

describe('initGeneratorInternal', () => {
  it('adds root oxlint config', async () => {
    const tree = createTreeWithEmptyWorkspace();

    await initGeneratorInternal(tree, {
      addPlugin: false,
      skipPackageJson: true,
      skipFormat: true,
    });

    expect(tree.exists('.oxlintrc.json')).toBe(true);
  });

  it('sets targetDefaults when plugin is disabled', async () => {
    const tree = createTreeWithEmptyWorkspace();

    await initGeneratorInternal(tree, {
      addPlugin: false,
      skipPackageJson: true,
      skipFormat: true,
    });

    const nxJson = readNxJson(tree);
    expect(nxJson.targetDefaults['@nx/oxlint:lint']).toBeDefined();
  });

  it('does not create .oxlintrc.json when oxlint.config.ts already exists', async () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write('oxlint.config.ts', 'export default { rules: {} };');

    await initGeneratorInternal(tree, {
      addPlugin: false,
      skipPackageJson: true,
      skipFormat: true,
    });

    expect(tree.exists('.oxlintrc.json')).toBe(false);
  });
});
