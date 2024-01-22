import {
  readJson,
  updateJson,
  type NxJsonConfiguration,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { jestInitGenerator } from './init';

describe('jest', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should add target defaults for test', async () => {
    updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
      json.namedInputs ??= {};
      json.namedInputs.production = ['default'];
      return json;
    });

    await jestInitGenerator(tree, {});

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
    expect(jestDefaults).toEqual({
      cache: true,
      inputs: ['default', '^production', '{workspaceRoot}/jest.preset.js'],
      options: {
        passWithNoTests: true,
      },
      configurations: {
        ci: {
          ci: true,
          codeCoverage: true,
        },
      },
    });
  });

  it('should not alter target defaults if jest.preset.js already exists', async () => {
    updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
      json.namedInputs ??= {};
      json.namedInputs.production = ['default', '^production'];
      return json;
    });
    await jestInitGenerator(tree, {});
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

    await jestInitGenerator(tree, {});

    expect(readJson<NxJsonConfiguration>(tree, 'nx.json')).toEqual(nxJson);
  });

  it('should add dependencies', async () => {
    await jestInitGenerator(tree, {});

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.devDependencies.jest).toBeDefined();
    expect(packageJson.devDependencies['@nx/jest']).toBeDefined();
  });
});
