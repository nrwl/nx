import { readProjectConfiguration, Tree } from '@nrwl/devkit';
import { Schema } from '../schema';
import { updateStorybookConfig } from './update-storybook-config';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { libraryGenerator } from '../../library/library';

describe('updateStorybookConfig', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should handle storybook config not existing', async () => {
    await libraryGenerator(tree, {
      name: 'my-source',
    });
    const projectConfig = readProjectConfiguration(tree, 'my-source');

    const schema: Schema = {
      projectName: 'my-source',
      destination: 'my-destination',
      importPath: undefined,
      updateImportPath: true,
    };

    updateStorybookConfig(tree, schema, projectConfig);
  });

  it('should update the import path for main.js', async () => {
    const storybookMain = `
      const rootMain = require('../../../.storybook/main');
      module.exports = rootMain;
    `;

    const storybookMainPath =
      '/libs/namespace/my-destination/.storybook/main.js';

    await libraryGenerator(tree, {
      name: 'my-source',
    });
    const projectConfig = readProjectConfiguration(tree, 'my-source');
    tree.write(storybookMainPath, storybookMain);

    const schema: Schema = {
      projectName: 'my-source',
      destination: 'namespace/my-destination',
      importPath: undefined,
      updateImportPath: true,
    };

    updateStorybookConfig(tree, schema, projectConfig);

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

    await libraryGenerator(tree, {
      name: 'my-source',
    });
    const projectConfig = readProjectConfiguration(tree, 'my-source');
    tree.write(storybookWebpackConfigPath, storybookWebpackConfig);

    const schema: Schema = {
      projectName: 'my-source',
      destination: 'namespace/my-destination',
      importPath: undefined,
      updateImportPath: true,
    };

    updateStorybookConfig(tree, schema, projectConfig);

    const storybookWebpackConfigAfter = tree
      .read(storybookWebpackConfigPath)
      .toString();
    expect(storybookWebpackConfigAfter).toContain(
      `const rootWebpackConfig = require('../../../../.storybook/webpack.config');`
    );
  });
});
