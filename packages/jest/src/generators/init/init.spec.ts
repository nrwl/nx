import { readJson, Tree, writeJson } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { jestInitGenerator } from './init';

describe('jest', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should generate files with --js flag', async () => {
    jestInitGenerator(tree, { js: true });

    expect(tree.exists('jest.config.js')).toBeTruthy();
    expect(tree.read('jest.config.js', 'utf-8')).toMatchInlineSnapshot(`
      "const { getJestProjects } = require('@nrwl/jest');

      module.exports = {
      projects: getJestProjects()
      };"
    `);
  });

  it('should generate files ', async () => {
    jestInitGenerator(tree, {});

    expect(tree.exists('jest.config.ts')).toBeTruthy();
    expect(tree.read('jest.config.ts', 'utf-8')).toMatchInlineSnapshot(`
      "import { getJestProjects } from '@nrwl/jest';

      export default {
      projects: getJestProjects()
      };"
    `);
  });

  it('should not override existing files', async () => {
    tree.write('jest.config.ts', `test`);
    jestInitGenerator(tree, {});
    expect(tree.read('jest.config.ts', 'utf-8')).toEqual('test');
  });

  it('should add dependencies', async () => {
    jestInitGenerator(tree, {});
    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.devDependencies.jest).toBeDefined();
    expect(packageJson.devDependencies['@nrwl/jest']).toBeDefined();
    expect(packageJson.devDependencies['@types/jest']).toBeDefined();
    expect(packageJson.devDependencies['ts-jest']).toBeDefined();
    expect(packageJson.devDependencies['ts-node']).toBeDefined();
  });

  it('should make js jest files', () => {
    jestInitGenerator(tree, { js: true });
    expect(tree.exists('jest.config.js')).toBeTruthy();
    expect(tree.exists('jest.preset.js')).toBeTruthy();
  });
  describe('Deprecated: --babelJest', () => {
    it('should add babel dependencies', async () => {
      jestInitGenerator(tree, { babelJest: true });
      const packageJson = readJson(tree, 'package.json');
      expect(packageJson.devDependencies['babel-jest']).toBeDefined();
    });
  });

  describe('--compiler', () => {
    it('should support tsc compiler', () => {
      jestInitGenerator(tree, { compiler: 'tsc' });
      const packageJson = readJson(tree, 'package.json');
      expect(packageJson.devDependencies['ts-jest']).toBeDefined();
    });

    it('should support babel compiler', () => {
      jestInitGenerator(tree, { compiler: 'babel' });
      const packageJson = readJson(tree, 'package.json');
      expect(packageJson.devDependencies['babel-jest']).toBeDefined();
    });

    it('should support swc compiler', () => {
      jestInitGenerator(tree, { compiler: 'swc' });
      const packageJson = readJson(tree, 'package.json');
      expect(packageJson.devDependencies['@swc/jest']).toBeDefined();
    });
  });

  describe('adds jest extension', () => {
    beforeEach(async () => {
      writeJson(tree, '.vscode/extensions.json', {
        recommendations: [
          'nrwl.angular-console',
          'angular.ng-template',
          'dbaeumer.vscode-eslint',
          'esbenp.prettier-vscode',
        ],
      });
    });

    it('should add the jest extension to the recommended property', async () => {
      jestInitGenerator(tree, {});
      const extensionsJson = readJson(tree, '.vscode/extensions.json');
      expect(extensionsJson).toMatchInlineSnapshot(`
        Object {
          "recommendations": Array [
            "nrwl.angular-console",
            "angular.ng-template",
            "dbaeumer.vscode-eslint",
            "esbenp.prettier-vscode",
            "firsttris.vscode-jest-runner",
          ],
        }
      `);
    });
  });
});
