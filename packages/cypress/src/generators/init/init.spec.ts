import 'nx/src/internal-testing-utils/mock-project-graph';

import { NxJsonConfiguration, readJson, Tree, updateJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import { cypressVersion } from '../../utils/versions';
import { cypressInitGenerator } from './init';
import { Schema } from './schema';

describe('init', () => {
  let tree: Tree;

  let options: Schema;

  beforeEach(() => {
    options = {
      addPlugin: true,
    };
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
    await cypressInitGenerator(tree, options);
    const packageJson = readJson(tree, 'package.json');

    expect(packageJson.devDependencies.cypress).toBeDefined();
    expect(packageJson.devDependencies['@nx/cypress']).toBeDefined();
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

    await cypressInitGenerator(tree, { ...options, addPlugin: false });

    expect(
      readJson<NxJsonConfiguration>(tree, 'nx.json').targetDefaults.e2e
    ).toEqual({
      cache: true,
      inputs: ['default', '^production'],
    });
  });

  it('should setup @nx/cypress/plugin', async () => {
    updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
      json.namedInputs ??= {};
      json.namedInputs.production = ['default'];
      return json;
    });

    await cypressInitGenerator(tree, options);

    expect(readJson<NxJsonConfiguration>(tree, 'nx.json'))
      .toMatchInlineSnapshot(`
      {
        "affected": {
          "defaultBase": "main",
        },
        "namedInputs": {
          "production": [
            "default",
            "!{projectRoot}/cypress/**/*",
            "!{projectRoot}/**/*.cy.[jt]s?(x)",
            "!{projectRoot}/cypress.config.[jt]s",
          ],
        },
        "plugins": [
          {
            "options": {
              "ciTargetName": "e2e-ci",
              "componentTestingTargetName": "component-test",
              "openTargetName": "open-cypress",
              "targetName": "e2e",
            },
            "plugin": "@nx/cypress/plugin",
          },
        ],
        "targetDefaults": {
          "build": {
            "cache": true,
          },
          "lint": {
            "cache": true,
          },
        },
      }
    `);
  });
});
