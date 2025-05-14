import 'nx/src/internal-testing-utils/mock-project-graph';

import { readProjectConfiguration, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { NormalizedSchema } from '../schema';
import { updateStorybookConfig } from './update-storybook-config';

// nx-ignore-next-line
const { libraryGenerator } = require('@nx/js');

describe('updateStorybookConfig', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should handle storybook config not existing', async () => {
    await libraryGenerator(tree, {
      directory: 'my-source',
    });
    const projectConfig = readProjectConfiguration(tree, 'my-source');
    const schema: NormalizedSchema = {
      projectName: 'my-source',
      destination: 'my-destination',
      importPath: '@proj/my-destination',
      updateImportPath: true,
      newProjectName: 'my-destination',
      relativeToRootDestination: 'my-destination',
    };

    expect(() =>
      updateStorybookConfig(tree, schema, projectConfig)
    ).not.toThrow();
  });

  it('should update the import path for main.js', async () => {
    const storybookMain = `
      const rootMain = require('../../.storybook/main');
      module.exports = rootMain;
    `;
    const storybookMainPath = 'namespace/my-destination/.storybook/main.js';

    await libraryGenerator(tree, {
      directory: 'my-source',
    });
    const projectConfig = readProjectConfiguration(tree, 'my-source');
    tree.write(storybookMainPath, storybookMain);
    const schema: NormalizedSchema = {
      projectName: 'my-source',
      destination: 'namespace/my-destination',
      importPath: '@proj/namespace-my-destination',
      updateImportPath: true,
      newProjectName: 'namespace-my-destination',
      relativeToRootDestination: 'namespace/my-destination',
    };

    updateStorybookConfig(tree, schema, projectConfig);

    const storybookMainAfter = tree.read(storybookMainPath, 'utf-8');
    expect(storybookMainAfter).toContain(
      `const rootMain = require('../../../.storybook/main');`
    );
  });

  it('should update the import path for webpack.config.json', async () => {
    const storybookWebpackConfig = `
      const rootWebpackConfig = require('../../.storybook/webpack.config');
    `;
    const storybookWebpackConfigPath =
      'namespace/my-destination/.storybook/webpack.config.js';
    await libraryGenerator(tree, {
      directory: 'my-source',
    });
    const projectConfig = readProjectConfiguration(tree, 'my-source');
    tree.write(storybookWebpackConfigPath, storybookWebpackConfig);
    const schema: NormalizedSchema = {
      projectName: 'my-source',
      destination: 'namespace/my-destination',
      importPath: '@proj/namespace-my-destination',
      updateImportPath: true,
      newProjectName: 'namespace-my-destination',
      relativeToRootDestination: 'namespace/my-destination',
    };

    updateStorybookConfig(tree, schema, projectConfig);

    const storybookWebpackConfigAfter = tree.read(
      storybookWebpackConfigPath,
      'utf-8'
    );
    expect(storybookWebpackConfigAfter).toContain(
      `const rootWebpackConfig = require('../../../.storybook/webpack.config');`
    );
  });

  describe('directory', () => {
    it('should update the import path for directory/main.js', async () => {
      const storybookMain = `
      const rootMain = require('../../.storybook/main');
      module.exports = rootMain;
    `;
      const storybookMainPath = 'namespace/my-destination/.storybook/main.js';

      const storybookNestedMain = `
      const rootMain = require('../../../.storybook/main');
      module.exports = rootMain;
    `;
      const storybookNestedMainPath =
        'namespace/my-destination/.storybook/nested/main.js';

      await libraryGenerator(tree, {
        directory: 'my-source',
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
        relativeToRootDestination: 'namespace/my-destination',
      };

      updateStorybookConfig(tree, schema, projectConfig);

      const storybookMainAfter = tree.read(storybookMainPath, 'utf-8');
      expect(storybookMainAfter).toContain(
        `const rootMain = require('../../../.storybook/main');`
      );
      const storybookNestedMainAfter = tree.read(
        storybookNestedMainPath,
        'utf-8'
      );
      expect(storybookNestedMainAfter).toContain(
        `const rootMain = require('../../../../.storybook/main');`
      );
    });

    it('should update the import path for directory/webpack.config.json', async () => {
      const storybookWebpackConfig = `
      const rootWebpackConfig = require('../../.storybook/webpack.config');
    `;
      const storybookWebpackConfigPath =
        'namespace/my-destination/.storybook/webpack.config.js';

      const storybookNestedWebpackConfig = `
      const rootWebpackConfig = require('../../../.storybook/webpack.config');
    `;
      const storybookNestedWebpackConfigPath =
        'namespace/my-destination/.storybook/nested/webpack.config.js';

      await libraryGenerator(tree, {
        directory: 'my-source',
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
        relativeToRootDestination: 'namespace/my-destination',
      };

      updateStorybookConfig(tree, schema, projectConfig);

      const storybookWebpackConfigAfter = tree.read(
        storybookWebpackConfigPath,
        'utf-8'
      );
      expect(storybookWebpackConfigAfter).toContain(
        `const rootWebpackConfig = require('../../../.storybook/webpack.config');`
      );

      const storybookNestedWebpackConfigAfter = tree.read(
        storybookNestedWebpackConfigPath,
        'utf-8'
      );
      expect(storybookNestedWebpackConfigAfter).toContain(
        `const rootWebpackConfig = require('../../../../.storybook/webpack.config');`
      );
    });
  });
});
