import 'nx/src/internal-testing-utils/mock-project-graph';

import {
  type NxJsonConfiguration,
  readJson,
  type Tree,
  updateJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { jestInitGenerator } from './init';
import { JestInitSchema } from './schema';

describe('jest', () => {
  let tree: Tree;
  let options: JestInitSchema;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    options = {
      addPlugin: true,
    };
  });

  it('should exclude jest files from production fileset', async () => {
    updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
      json.namedInputs ??= {};
      json.namedInputs.production = ['default'];
      return json;
    });

    await jestInitGenerator(tree, options);

    const productionFileSet = readJson<NxJsonConfiguration>(tree, 'nx.json')
      .namedInputs.production;
    const jestDefaults = readJson<NxJsonConfiguration>(tree, 'nx.json')
      .targetDefaults['@nx/jest:jest'];
    expect(productionFileSet).toContain(
      '!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)'
    );
    expect(productionFileSet).toContain('!{projectRoot}/tsconfig.spec.json');
    expect(productionFileSet).toContain('!{projectRoot}/jest.config.[jt]s');
    expect(productionFileSet).toContain('!{projectRoot}/src/test-setup.[jt]s');
  });

  it('should not alter target defaults if jest.preset.js already exists', async () => {
    updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
      json.namedInputs ??= {};
      json.namedInputs.production = ['default', '^production'];
      return json;
    });
    await jestInitGenerator(tree, options);
    let nxJson: NxJsonConfiguration;
    updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
      json.namedInputs ??= {};
      json.namedInputs.production = [
        'default',
        '^production',
        '!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)',
        '!{projectRoot}/**/*.md',
      ];
      json.targetDefaults.test = {
        inputs: [
          'default',
          '^production',
          '{workspaceRoot}/jest.preset.js',
          '{workspaceRoot}/testSetup.ts',
        ],
      };
      nxJson = json;
      return json;
    });
    tree.write('jest.preset.js', '');

    await jestInitGenerator(tree, options);

    expect(readJson<NxJsonConfiguration>(tree, 'nx.json')).toEqual(nxJson);
  });

  it('should add dependencies', async () => {
    await jestInitGenerator(tree, options);

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.devDependencies.jest).toBeDefined();
    expect(packageJson.devDependencies['@nx/jest']).toBeDefined();
  });
});
