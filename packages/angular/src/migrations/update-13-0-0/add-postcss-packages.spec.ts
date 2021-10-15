import { readJson, Tree, updateJson } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import addPostCssImport from './add-postcss-packages';

describe('add-postcss-import migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace(2);
  });

  it('should not add postcss-import when ng-packagr is not installed', () => {
    addPostCssImport(tree);

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.devDependencies['postcss']).toBeUndefined();
    expect(packageJson.devDependencies['postcss-import']).toBeUndefined();
    expect(packageJson.devDependencies['postcss-preset-env']).toBeUndefined();
    expect(packageJson.devDependencies['postcss-url']).toBeUndefined();
  });

  it('should add postcss-import when ng-packagr is installed', () => {
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies['ng-packagr'] = '~12.2.3';
      return json;
    });

    addPostCssImport(tree);

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.devDependencies['postcss']).toBeDefined();
    expect(packageJson.devDependencies['postcss-import']).toBeDefined();
    expect(packageJson.devDependencies['postcss-preset-env']).toBeDefined();
    expect(packageJson.devDependencies['postcss-url']).toBeDefined();
  });
});
