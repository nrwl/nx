import { NxJsonConfiguration, readJson, Tree, updateJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import { cypressVersion } from '../../utils/versions';
import { cypressInitGenerator } from './init';

describe('init', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should add dependencies into `package.json` file', async () => {
    const existing = 'existing';
    const existingVersion = '1.0.0';
    updateJson(tree, 'package.json', (json) => {
      json.dependencies['@nx/cypress'] = cypressVersion;

      json.dependencies[existing] = existingVersion;
      json.devDependencies[existing] = existingVersion;
      return json;
    });
    await cypressInitGenerator(tree, {});
    const packageJson = readJson(tree, 'package.json');

    expect(packageJson.devDependencies.cypress).toBeDefined();
    expect(packageJson.devDependencies['@nx/cypress']).toBeDefined();
    expect(packageJson.devDependencies['@types/node']).toBeDefined();
    expect(packageJson.devDependencies[existing]).toBeDefined();
    expect(packageJson.dependencies['@nx/cypress']).toBeUndefined();
    expect(packageJson.dependencies[existing]).toBeDefined();
  });

  it('should setup e2e target defaults', async () => {
    updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
      json.namedInputs ??= {};
      json.namedInputs.production = ['default'];
      return json;
    });

    await cypressInitGenerator(tree, {});

    expect(
      readJson<NxJsonConfiguration>(tree, 'nx.json').targetDefaults.e2e
    ).toEqual({
      inputs: ['default', '^production'],
    });
  });
});
