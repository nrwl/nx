import { readJson, updateJson, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import * as cypressVersions from '../../utils/versions';
import migration from './update-cypress-version-13-6-6';

describe('update-cypress-version migration', () => {
  let tree: Tree;

  function setCypressVersion(version: string) {
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies ??= {};
      json.devDependencies.cypress = version;
      return json;
    });
    const major = parseInt(version.split('.')[0].replace('^', ''), 10);
    jest
      .spyOn(cypressVersions, 'getInstalledCypressMajorVersion')
      .mockReturnValue(major);
  }

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should bump cypress version to ^13.6.6', async () => {
    setCypressVersion('^13.0.0');

    await migration(tree);

    const { devDependencies } = readJson(tree, 'package.json');
    expect(devDependencies.cypress).toBe('^13.6.6');
  });

  it('should not update cypress version if it is not >= 13', async () => {
    setCypressVersion('^12.0.0');

    await migration(tree);

    const { devDependencies } = readJson(tree, 'package.json');
    expect(devDependencies.cypress).toBe('^12.0.0');
  });
});
