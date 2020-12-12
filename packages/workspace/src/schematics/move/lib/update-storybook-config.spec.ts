import { Tree } from '@angular-devkit/schematics';
import { UnitTestTree } from '@angular-devkit/schematics/testing';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { callRule, runSchematic } from '../../../utils/testing';
import { Schema } from '../schema';
import { updateStorybookConfig } from './update-storybook-config';

describe('updateStorybookConfig Rule', () => {
  let tree: UnitTestTree;

  beforeEach(async () => {
    tree = new UnitTestTree(Tree.empty());
    tree = createEmptyWorkspace(tree) as UnitTestTree;
  });

  it('should handle storybook config not existing', async () => {
    tree = await runSchematic('lib', { name: 'my-source' }, tree);

    const schema: Schema = {
      projectName: 'my-source',
      destination: 'my-destination',
      importPath: undefined,
      updateImportPath: true,
    };

    await expect(
      callRule(updateStorybookConfig(schema), tree)
    ).resolves.not.toThrow();
  });

  it('should update the import path for main.js', async () => {
    const storybookMain = `
      const rootMain = require('../../../.storybook/main');
      module.exports = rootMain;
    `;

    const storybookMainPath =
      '/libs/namespace/my-destination/.storybook/main.js';

    tree = await runSchematic('lib', { name: 'my-source' }, tree);
    tree.create(storybookMainPath, storybookMain);

    const schema: Schema = {
      projectName: 'my-source',
      destination: 'namespace/my-destination',
      importPath: undefined,
      updateImportPath: true,
    };

    tree = (await callRule(
      updateStorybookConfig(schema),
      tree
    )) as UnitTestTree;

    const storybookMainAfter = tree.read(storybookMainPath).toString();
    expect(storybookMainAfter).toContain(
      `const rootMain = require('../../../../.storybook/main');`
    );
  });

  it('should update the import path for webpack.config.json', async () => {
    const storybookWebpackConfig = `
      const rootWebpackConfig = require('../../../.storybook/webpack.config');
    `;

    const storybookWebpackConfigPath =
      '/libs/namespace/my-destination/.storybook/webpack.config.js';

    tree = await runSchematic('lib', { name: 'my-source' }, tree);
    tree.create(storybookWebpackConfigPath, storybookWebpackConfig);

    const schema: Schema = {
      projectName: 'my-source',
      destination: 'namespace/my-destination',
      importPath: undefined,
      updateImportPath: true,
    };

    tree = (await callRule(
      updateStorybookConfig(schema),
      tree
    )) as UnitTestTree;

    const storybookWebpackConfigAfter = tree
      .read(storybookWebpackConfigPath)
      .toString();
    expect(storybookWebpackConfigAfter).toContain(
      `const rootWebpackConfig = require('../../../../.storybook/webpack.config');`
    );
  });
});
