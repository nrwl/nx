import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { addProjectConfiguration, Tree, writeJson } from '@nrwl/devkit';
import removeTypescriptPlugin from './remove-typescript-plugin';

describe('remove typescript plugin', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();

    addProjectConfiguration(tree, 'proj', {
      root: 'proj',
      targets: {
        cypress: {
          executor: '@nrwl/cypress:cypress',
          options: {
            cypressConfig: 'proj/cypress.json',
          },
        },
      },
    });

    writeJson(tree, 'proj/cypress.json', {
      pluginsFile: './plugins.js',
    });

    tree.write(
      'proj/plugins.js',
      `
      // ***********************************************************
      // This example plugins/index.js can be used to load plugins
      //
      // You can change the location of this file or turn off loading
      // the plugins file with the 'pluginsFile' configuration option.
      //
      // You can read more here:
      // https://on.cypress.io/plugins-guide
      // ***********************************************************
      
      // This function is called when a project is opened or re-opened (e.g. due to
      // the project's config changing)
      
      const { preprocessTypescript } = require('@nrwl/cypress/plugins/preprocessor');
      
      module.exports = (on, config) => {
        // \`on\` is used to hook into various events Cypress emits
        // \`config\` is the resolved Cypress config
      
        // Preprocess Typescript
        on('file:preprocessor', preprocessTypescript(config));
      };
    `
    );
  });

  it('should remove the plugin', async () => {
    await removeTypescriptPlugin(tree);

    expect(tree.read('proj/plugins.js', 'utf-8')).not.toContain(
      'preprocessTypescript(config)'
    );
  });

  it('should not remove the plugin if they have a custom webpack config', async () => {
    tree.write(
      'proj/plugins.js',
      tree
        .read('proj/plugins.js', 'utf-8')
        .replace(
          'preprocessTypescript(config)',
          'preprocessTypescript(config, webpackFunction)'
        )
    );
    await removeTypescriptPlugin(tree);

    expect(tree.read('proj/plugins.js', 'utf-8')).toContain(
      'preprocessTypescript(config, webpackFunction)'
    );
  });
});
