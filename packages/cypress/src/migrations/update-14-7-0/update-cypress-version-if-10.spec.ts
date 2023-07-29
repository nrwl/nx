import { updateCypressVersionIf10 } from './update-cypress-version-if-10';
import { installedCypressVersion } from '../../utils/cypress-version';
import { readJson, Tree, updateJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

describe('Update Cypress if v10 migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    tree.write(
      'package.json',
      JSON.stringify({
        dependencies: {},
        devDependencies: {},
      })
    );
  });

  it('should update the version if the installed version is v10', () => {
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies['cypress'] = '^10.5.0';
      return json;
    });
    updateCypressVersionIf10(tree);
    const pkgJson = readJson(tree, 'package.json');
    expect(pkgJson.devDependencies['cypress']).toBe('^10.7.0');
  });

  it('should not update the version < v10', () => {
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies['cypress'] = '9.0.0';
      return json;
    });
    updateCypressVersionIf10(tree);
    const pkgJson = readJson(tree, 'package.json');
    expect(pkgJson.devDependencies['cypress']).toBe('9.0.0');
  });

  it('should not update if the version > v10', () => {
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies['cypress'] = '11.0.0';
      return json;
    });
    updateCypressVersionIf10(tree);
    const pkgJson = readJson(tree, 'package.json');
    expect(pkgJson.devDependencies['cypress']).toBe('11.0.0');
  });

  it('should not update if the version is not defined', () => {
    updateCypressVersionIf10(tree);
    const pkgJson = readJson(tree, 'package.json');
    expect(pkgJson.devDependencies['cypress']).toBe(undefined);
  });

  it('should not update if v10.7.0 < version < v11', () => {
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies['cypress'] = '^10.8.0';
      return json;
    });
    updateCypressVersionIf10(tree);
    const pkgJson1 = readJson(tree, 'package.json');
    expect(pkgJson1.devDependencies['cypress']).toBe('^10.8.0');
  });

  it('should be idempotent', () => {
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies['cypress'] = '^10.3.0';
      return json;
    });
    updateCypressVersionIf10(tree);
    const pkgJson1 = readJson(tree, 'package.json');
    expect(pkgJson1.devDependencies['cypress']).toBe('^10.7.0');
    updateCypressVersionIf10(tree);
    const pkgJson2 = readJson(tree, 'package.json');
    expect(pkgJson2.devDependencies['cypress']).toBe('^10.7.0');
  });
});
