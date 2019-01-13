import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import * as path from 'path';
import { Tree, VirtualTree } from '@angular-devkit/schematics';
import {
  createEmptyWorkspace,
  createLib,
  runSchematic
} from '../../utils/testing-utils';
import { readJsonInTree } from '@nrwl/schematics/src/utils/ast-utils';

describe('lib', () => {
  let appTree: Tree;

  beforeEach(() => {
    appTree = new VirtualTree();
    appTree = createEmptyWorkspace(appTree);
  });

  it('should generate files', async () => {
    const resultTree = await runSchematic('jest', {}, appTree);
    expect(resultTree.exists('jest.config.js')).toBeTruthy();
  });

  it('should add dependencies', async () => {
    const resultTree = await runSchematic('jest', {}, appTree);
    const packageJson = readJsonInTree(resultTree, 'package.json');
    expect(packageJson.devDependencies.jest).toBeDefined();
    expect(packageJson.devDependencies['@nrwl/builders']).toBeDefined();
    expect(packageJson.devDependencies['@types/jest']).toBeDefined();
    expect(packageJson.devDependencies['jest-preset-angular']).toBeDefined();
  });
});
