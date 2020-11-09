import { Tree } from '@angular-devkit/schematics';
import { readJsonInTree, updateJsonInTree } from '@nrwl/workspace';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { callRule, runSchematic } from '../../utils/testing';

import { JestInitSchema } from './schema';

describe('jest', () => {
  let appTree: Tree;

  beforeEach(() => {
    appTree = Tree.empty();
    appTree = createEmptyWorkspace(appTree);
  });

  it('should generate files', async () => {
    const resultTree = await runSchematic<JestInitSchema>('init', {}, appTree);

    expect(resultTree.exists('jest.config.js')).toBeTruthy();
    expect(resultTree.readContent('jest.config.js')).toMatchInlineSnapshot(`
      "module.exports = {
      projects: []
      };"
    `);
  });

  it('should not override existing files', async () => {
    appTree.create('jest.config.js', `test`);
    const resultTree = await runSchematic('ng-add', {}, appTree);
    expect(resultTree.read('jest.config.js').toString()).toEqual('test');
  });

  it('should add dependencies', async () => {
    const resultTree = await runSchematic<JestInitSchema>('init', {}, appTree);
    const packageJson = readJsonInTree(resultTree, 'package.json');
    expect(packageJson.devDependencies.jest).toBeDefined();
    expect(packageJson.devDependencies['@nrwl/jest']).toBeDefined();
    expect(packageJson.devDependencies['@types/jest']).toBeDefined();
    expect(packageJson.devDependencies['ts-jest']).toBeDefined();
  });

  describe('--babelJest', () => {
    it('should add babel dependencies', async () => {
      const resultTree = await runSchematic<JestInitSchema>(
        'init',
        { babelJest: true },
        appTree
      );
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

  describe('adds jest extension', () => {
    beforeEach(async () => {
      appTree = await callRule(
        updateJsonInTree('.vscode/extensions.json', () => ({
          recommendations: [
            'nrwl.angular-console',
            'angular.ng-template',
            'ms-vscode.vscode-typescript-tslint-plugin',
            'esbenp.prettier-vscode',
          ],
        })),
        appTree
      );
    });

    it('should add the jest extension to the recommended property', async () => {
      const resultTree = await runSchematic<JestInitSchema>(
        'init',
        {},
        appTree
      );
      const extensionsJson = readJsonInTree(
        resultTree,
        '.vscode/extensions.json'
      );
      expect(extensionsJson).toMatchInlineSnapshot(`
        Object {
          "recommendations": Array [
            "nrwl.angular-console",
            "angular.ng-template",
            "ms-vscode.vscode-typescript-tslint-plugin",
            "esbenp.prettier-vscode",
            "firsttris.vscode-jest-runner",
          ],
        }
      `);
    });
  });
});
