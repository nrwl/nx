import '@nx/devkit/internal-testing-utils/mock-project-graph';

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
    // ensure targetDefaults starts as an empty map so assertions target it
    updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
      json.targetDefaults = {};
      return json;
    });
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

    await jestInitGenerator(tree, { ...options, addPlugin: false });

    const productionFileSet = readJson<NxJsonConfiguration>(tree, 'nx.json')
      .namedInputs.production;
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
    await jestInitGenerator(tree, { ...options, addPlugin: false });
    let nxJson: NxJsonConfiguration;
    updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
      json.namedInputs ??= {};
      json.namedInputs.production = [
        'default',
        '^production',
        '!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)',
        '!{projectRoot}/**/*.md',
      ];
      json.targetDefaults ??= {};
      json.targetDefaults['test'] = {
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

    await jestInitGenerator(tree, { ...options, addPlugin: false });

    expect(readJson<NxJsonConfiguration>(tree, 'nx.json')).toEqual(nxJson);
  });

  it('should add dependencies', async () => {
    await jestInitGenerator(tree, options);

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.devDependencies.jest).toBeDefined();
    expect(packageJson.devDependencies['@nx/jest']).toBeDefined();
  });

  it('adds the generic @nx/jest:jest default without touching existing target-scoped or filtered jest entries', async () => {
    updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
      json.targetDefaults = {
        test: { executor: '@nx/jest:jest' },
        '@nx/jest:jest': [{ filter: { projects: ['tag:unit'] }, cache: false }],
      };
      return json;
    });

    await jestInitGenerator(tree, { ...options, addPlugin: false });

    const td = readJson<NxJsonConfiguration>(tree, 'nx.json').targetDefaults;
    // The target-scoped and filtered entries the user authored are left as-is.
    expect(td['test']).toEqual({ executor: '@nx/jest:jest' });
    expect(td['@nx/jest:jest']).toEqual([
      { filter: { projects: ['tag:unit'] }, cache: false },
      // A new unfiltered baseline is appended for the executor.
      expect.objectContaining({
        cache: true,
        options: { passWithNoTests: true },
        configurations: { ci: { ci: true, codeCoverage: true } },
        inputs: expect.arrayContaining([
          'default',
          '^default',
          expect.stringMatching(/^\{workspaceRoot\}\/jest\.preset\.(js|ts)$/),
        ]),
      }),
    ]);
  });
});
