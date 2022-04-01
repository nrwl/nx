import { addProjectConfiguration, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

import { formatFile } from '../../../utils/format-file';

import { replaceAppImportWithStorybookToggle } from './replace-app-import-with-storybook-toggle';

describe('replaceAppImportWithStorybookToggle', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();

    addProjectConfiguration(tree, 'products', {
      root: 'apps/products',
      sourceRoot: 'apps/products/src',
    });
  });

  it('should update the main file with import from storybook', async () => {
    tree.write(
      '/apps/products/src/main.tsx',
      formatFile`import { AppRegistry } from 'react-native';
      import App from './app/App';
      
      AppRegistry.registerComponent('main', () => App);
      `
    );
    replaceAppImportWithStorybookToggle(tree, {
      name: 'products',
      js: false,
    });

    const mainFile = tree.read('apps/products/src/main.tsx', 'utf-8');
    expect(formatFile`${mainFile}`).toEqual(
      formatFile`import { AppRegistry } from 'react-native';
      import App from './storybook/toggle-storybook';
      
      AppRegistry.registerComponent('main', () => App);`
    );
  });

  it('should not update the main file if import is already updated', async () => {
    tree.write(
      '/apps/products/src/main.tsx',
      formatFile`import { AppRegistry } from 'react-native';
      import App from './app/App';
      
      AppRegistry.registerComponent('main', () => App);
      `
    );
    replaceAppImportWithStorybookToggle(tree, {
      name: 'products',
      js: false,
    });

    const mainFile = tree.read('apps/products/src/main.tsx', 'utf-8');
    expect(formatFile`${mainFile}`).toEqual(
      formatFile`import { AppRegistry } from 'react-native';
      import App from './storybook/toggle-storybook';
      
      AppRegistry.registerComponent('main', () => App);`
    );
  });
});
