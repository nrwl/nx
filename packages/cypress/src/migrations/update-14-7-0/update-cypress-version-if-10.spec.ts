import { updateCypressVersionIf10 } from './update-cypress-version-if-10';
import { installedCypressVersion } from '../../utils/cypress-version';
import { readJson, Tree, updateJson } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

jest.mock('../../utils/cypress-version');
describe('Update Cypress if v10 migration', () => {
  let tree: Tree;
  let mockedInstalledCypressVersion: jest.Mock<
    ReturnType<typeof installedCypressVersion>
  > = installedCypressVersion as never;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    tree.write(
      'package.json',
      JSON.stringify({
        dependencies: {},
        devDependencies: {},
      })
    );
  });

  it('should update the version if the installed version is v10', () => {
    mockedInstalledCypressVersion.mockReturnValue(10);
    updateCypressVersionIf10(tree);
    const pkgJson = readJson(tree, 'package.json');
    expect(pkgJson.devDependencies['cypress']).toBe('^10.5.0');
  });

  it('should not update the version < v10', () => {
    mockedInstalledCypressVersion.mockReturnValue(9);
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies['cypress'] = '9.0.0';
      return json;
    });
    updateCypressVersionIf10(tree);
    const pkgJson = readJson(tree, 'package.json');
    expect(pkgJson.devDependencies['cypress']).toBe('9.0.0');
  });

  it('should not update if the version > v10', () => {
    mockedInstalledCypressVersion.mockReturnValue(11);
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies['cypress'] = '11.0.0';
      return json;
    });
    updateCypressVersionIf10(tree);
    const pkgJson = readJson(tree, 'package.json');
    expect(pkgJson.devDependencies['cypress']).toBe('11.0.0');
  });

  it('should not update if the version is not defined', () => {
    mockedInstalledCypressVersion.mockReturnValue(0);
    updateCypressVersionIf10(tree);
    const pkgJson = readJson(tree, 'package.json');
    expect(pkgJson.devDependencies['cypress']).toBe(undefined);
  });

  it('should be idempotent', () => {
    mockedInstalledCypressVersion.mockReturnValue(10);
    updateCypressVersionIf10(tree);
    const pkgJson1 = readJson(tree, 'package.json');
    expect(pkgJson1.devDependencies['cypress']).toBe('^10.5.0');
    updateCypressVersionIf10(tree);
    const pkgJson2 = readJson(tree, 'package.json');
    expect(pkgJson2.devDependencies['cypress']).toBe('^10.5.0');
  });
});
