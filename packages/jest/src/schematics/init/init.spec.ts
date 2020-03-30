import { Tree } from '@angular-devkit/schematics';
import { readJsonInTree } from '@nrwl/workspace';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { runSchematic } from '../../utils/testing';

describe('jest', () => {
  let appTree: Tree;

  beforeEach(() => {
    appTree = Tree.empty();
    appTree = createEmptyWorkspace(appTree);
  });

  it('should generate files', async () => {
    const resultTree = await runSchematic('init', {}, appTree);
    expect(resultTree.exists('jest.config.js')).toBeTruthy();
  });

  it('should not override existing files', async () => {
    appTree.create('jest.config.js', `test`);
    const resultTree = await runSchematic('ng-add', {}, appTree);
    expect(resultTree.read('jest.config.js').toString()).toEqual('test');
  });

  it('should add dependencies', async () => {
    const resultTree = await runSchematic('init', {}, appTree);
    const packageJson = readJsonInTree(resultTree, 'package.json');
    expect(packageJson.devDependencies.jest).toBeDefined();
    expect(packageJson.devDependencies['@nrwl/jest']).toBeDefined();
    expect(packageJson.devDependencies['@types/jest']).toBeDefined();
    expect(packageJson.devDependencies['ts-jest']).toBeDefined();
  });

  it('should add babel dependencies', async () => {
    const resultTree = await runSchematic('init', { babelJest: true }, appTree);
    const packageJson = readJsonInTree(resultTree, 'package.json');
    expect(packageJson.devDependencies['@babel/core']).toBeDefined();
    expect(packageJson.devDependencies['@babel/preset-env']).toBeDefined();
    expect(
      packageJson.devDependencies['@babel/preset-typescript']
    ).toBeDefined();
    expect(packageJson.devDependencies['@babel/preset-react']).toBeDefined();
    expect(packageJson.devDependencies['babel-jest']).toBeDefined();
  });
});
