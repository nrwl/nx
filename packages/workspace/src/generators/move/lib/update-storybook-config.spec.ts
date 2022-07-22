import { readProjectConfiguration, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { libraryGenerator } from '../../library/library';
import { NormalizedSchema } from '../schema';
import { updateStorybookConfig } from './update-storybook-config';

describe('updateStorybookConfig', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should handle storybook config not existing', async () => {
    await libraryGenerator(tree, {
      name: 'my-source',
      standaloneConfig: false,
    });
    const projectConfig = readProjectConfiguration(tree, 'my-source');
    const schema: NormalizedSchema = {
      projectName: 'my-source',
      destination: 'my-destination',
      importPath: '@proj/my-destination',
      updateImportPath: true,
      newProjectName: 'my-destination',
      relativeToRootDestination: 'libs/my-destination',
    };

    expect(() =>
      updateStorybookConfig(tree, schema, projectConfig)
    ).not.toThrow();
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
      standaloneConfig: false,
    });
    const projectConfig = readProjectConfiguration(tree, 'my-source');
    tree.write(storybookMainPath, storybookMain);
    const schema: NormalizedSchema = {
      projectName: 'my-source',
      destination: 'namespace/my-destination',
      importPath: '@proj/namespace-my-destination',
      updateImportPath: true,
      newProjectName: 'namespace-my-destination',
      relativeToRootDestination: 'libs/namespace/my-destination',
    };

    updateStorybookConfig(tree, schema, projectConfig);

    const storybookMainAfter = tree.read(storybookMainPath, 'utf-8');
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
      standaloneConfig: false,
    });
    const projectConfig = readProjectConfiguration(tree, 'my-source');
    tree.write(storybookWebpackConfigPath, storybookWebpackConfig);
    const schema: NormalizedSchema = {
      projectName: 'my-source',
      destination: 'namespace/my-destination',
      importPath: '@proj/namespace-my-destination',
      updateImportPath: true,
      newProjectName: 'namespace-my-destination',
      relativeToRootDestination: 'libs/namespace/my-destination',
    };

    updateStorybookConfig(tree, schema, projectConfig);

    const storybookWebpackConfigAfter = tree.read(
      storybookWebpackConfigPath,
      'utf-8'
    );
    expect(storybookWebpackConfigAfter).toContain(
      `const rootWebpackConfig = require('../../../../.storybook/webpack.config');`
    );
  });

  describe('directory', () => {
    it('should update the import path for directory/main.js', async () => {
      const storybookMain = `
      const rootMain = require('../../../.storybook/main');
      module.exports = rootMain;
    `;
      const storybookMainPath =
        '/libs/namespace/my-destination/.storybook/main.js';

      const storybookNestedMain = `
      const rootMain = require('../../../../.storybook/main');
      module.exports = rootMain;
    `;
      const storybookNestedMainPath =
        '/libs/namespace/my-destination/.storybook/nested/main.js';

      await libraryGenerator(tree, {
        name: 'my-source',
        standaloneConfig: false,
      });
      const projectConfig = readProjectConfiguration(tree, 'my-source');
      tree.write(storybookMainPath, storybookMain);
      tree.write(storybookNestedMainPath, storybookNestedMain);
      const schema: NormalizedSchema = {
        projectName: 'my-source',
        destination: 'namespace/my-destination',
        importPath: '@proj/namespace-my-destination',
        updateImportPath: true,
        newProjectName: 'namespace-my-destination',
        relativeToRootDestination: 'libs/namespace/my-destination',
      };

      updateStorybookConfig(tree, schema, projectConfig);

      const storybookMainAfter = tree.read(storybookMainPath, 'utf-8');
      expect(storybookMainAfter).toContain(
        `const rootMain = require('../../../../.storybook/main');`
      );
      const storybookNestedMainAfter = tree.read(
        storybookNestedMainPath,
        'utf-8'
      );
      expect(storybookNestedMainAfter).toContain(
        `const rootMain = require('../../../../../.storybook/main');`
      );
    });

    it('should update the import path for directory/webpack.config.json', async () => {
      const storybookWebpackConfig = `
      const rootWebpackConfig = require('../../../.storybook/webpack.config');
    `;
      const storybookWebpackConfigPath =
        '/libs/namespace/my-destination/.storybook/webpack.config.js';

      const storybookNestedWebpackConfig = `
      const rootWebpackConfig = require('../../../../.storybook/webpack.config');
    `;
      const storybookNestedWebpackConfigPath =
        '/libs/namespace/my-destination/.storybook/nested/webpack.config.js';

      await libraryGenerator(tree, {
        name: 'my-source',
        standaloneConfig: false,
      });
      const projectConfig = readProjectConfiguration(tree, 'my-source');
      tree.write(storybookWebpackConfigPath, storybookWebpackConfig);
      tree.write(
        storybookNestedWebpackConfigPath,
        storybookNestedWebpackConfig
      );
      const schema: NormalizedSchema = {
        projectName: 'my-source',
        destination: 'namespace/my-destination',
        importPath: '@proj/namespace-my-destination',
        updateImportPath: true,
        newProjectName: 'namespace-my-destination',
        relativeToRootDestination: 'libs/namespace/my-destination',
      };

      updateStorybookConfig(tree, schema, projectConfig);

      const storybookWebpackConfigAfter = tree.read(
        storybookWebpackConfigPath,
        'utf-8'
      );
      expect(storybookWebpackConfigAfter).toContain(
        `const rootWebpackConfig = require('../../../../.storybook/webpack.config');`
      );

      const storybookNestedWebpackConfigAfter = tree.read(
        storybookNestedWebpackConfigPath,
        'utf-8'
      );
      expect(storybookNestedWebpackConfigAfter).toContain(
        `const rootWebpackConfig = require('../../../../../.storybook/webpack.config');`
      );
    });
  });
});
