import 'nx/src/internal-testing-utils/mock-project-graph';

import {
  type NxJsonConfiguration,
  readJson,
  type TargetDefaultEntry,
  type Tree,
  updateJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { jestInitGenerator } from './init';
import { JestInitSchema } from './schema';

describe('jest', () => {
  let tree: Tree;
  let options: JestInitSchema;

  function getJestTargetDefaults(): TargetDefaultEntry[] {
    const td =
      readJson<NxJsonConfiguration>(tree, 'nx.json').targetDefaults ?? [];
    if (!Array.isArray(td)) {
      throw new Error('expected array-shaped targetDefaults in test');
    }
    return td.filter(
      (entry): entry is TargetDefaultEntry => entry.executor === '@nx/jest:jest'
    );
  }

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    // ensure targetDefaults starts as the array shape so assertions target it
    updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
      json.targetDefaults = [];
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
      const entries = (json.targetDefaults ?? []) as TargetDefaultEntry[];
      entries.push({
        target: 'test',
        inputs: [
          'default',
          '^production',
          '{workspaceRoot}/jest.preset.js',
          '{workspaceRoot}/testSetup.ts',
        ],
      });
      json.targetDefaults = entries;
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

  it('should patch existing target-scoped and filtered jest defaults in place', async () => {
    updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
      json.targetDefaults = [
        {
          target: 'test',
          executor: '@nx/jest:jest',
        },
        {
          executor: '@nx/jest:jest',
          projects: 'tag:unit',
          cache: false,
        },
      ];
      return json;
    });

    await jestInitGenerator(tree, { ...options, addPlugin: false });

    const jestDefaults = getJestTargetDefaults();
    expect(jestDefaults).toHaveLength(2);
    expect(jestDefaults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          target: 'test',
          executor: '@nx/jest:jest',
          cache: true,
          configurations: {
            ci: {
              ci: true,
              codeCoverage: true,
            },
          },
          options: {
            passWithNoTests: true,
          },
        }),
        expect.objectContaining({
          executor: '@nx/jest:jest',
          projects: 'tag:unit',
          cache: false,
          configurations: {
            ci: {
              ci: true,
              codeCoverage: true,
            },
          },
          options: {
            passWithNoTests: true,
          },
        }),
      ])
    );
    for (const entry of jestDefaults) {
      expect(entry.inputs).toEqual(
        expect.arrayContaining([
          'default',
          '^default',
          expect.stringMatching(/^\{workspaceRoot\}\/jest\.preset\.(js|ts)$/),
        ])
      );
    }
  });
});
