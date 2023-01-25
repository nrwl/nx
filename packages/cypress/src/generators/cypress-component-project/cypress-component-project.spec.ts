import {
  addProjectConfiguration,
  ProjectConfiguration,
  readJson,
  readProjectConfiguration,
  Tree,
  updateJson,
  updateProjectConfiguration,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { installedCypressVersion } from '../../utils/cypress-version';
import { cypressComponentProject } from './cypress-component-project';

jest.mock('../../utils/cypress-version');
let projectConfig: ProjectConfiguration = {
  projectType: 'library',
  sourceRoot: 'libs/cool-lib/src',
  root: 'libs/cool-lib',
  targets: {
    build: {
      executor: '@nrwl/web:rollup',
      options: {
        tsConfig: 'libs/cool-lib/tsconfig.lib.json',
      },
    },
    test: {
      executor: '@nrwl/jest:jest',
      options: {
        jestConfig: 'libs/cool-lib/jest.config.js',
      },
    },
  },
};
describe('Cypress Component Project', () => {
  let tree: Tree;
  let mockedInstalledCypressVersion: jest.Mock<
    ReturnType<typeof installedCypressVersion>
  > = installedCypressVersion as never;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'cool-lib', projectConfig);
    tree.write(
      '.gitignore',
      `
# compiled output
/dist
/tmp
/out-tsc
    `
    );
    tree.write(
      'libs/cool-lib/tsconfig.lib.json',
      `
{
  "extends": "./tsconfig.json",
  "exclude": [
    "**/*.spec.ts",
    "**/*.test.ts",
    "**/*.spec.tsx",
    "**/*.test.tsx",
    "**/*.spec.js",
    "**/*.test.js",
    "**/*.spec.jsx",
    "**/*.test.jsx",
    "**/*.cy.ts"
  ],
  "include": [
    "**/*.js",
    "**/*.jsx",
    "**/*.ts",
    "**/*.tsx"
  ]
}
`
    );
    tree.write(
      'libs/cool-lib/tsconfig.json',
      `
{
  "references": [
    {
      "path": "./tsconfig.lib.json"
    },
    {
      "path": "./tsconfig.spec.json"
    }
  ]
}
`
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should add base cypress component testing config', async () => {
    mockedInstalledCypressVersion.mockReturnValue(10);
    await cypressComponentProject(tree, {
      project: 'cool-lib',
      skipFormat: false,
    });
    const projectConfig = readProjectConfiguration(tree, 'cool-lib');
    expect(tree.exists('libs/cool-lib/cypress.config.ts')).toEqual(true);
    expect(tree.exists('libs/cool-lib/cypress')).toEqual(true);
    expect(
      tree.exists('libs/cool-lib/cypress/support/component-index.html')
    ).toEqual(true);
    expect(tree.exists('libs/cool-lib/cypress/fixtures/example.json')).toEqual(
      true
    );
    expect(tree.exists('libs/cool-lib/cypress/support/commands.ts')).toEqual(
      true
    );
    expect(tree.exists('libs/cool-lib/cypress/support/component.ts')).toEqual(
      true
    );
    expect(projectConfig.targets['component-test']).toMatchSnapshot();

    expect(tree.exists('libs/cool-lib/cypress/tsconfig.cy.json')).toEqual(true);
    const cyTsConfig = readJson(tree, 'libs/cool-lib/cypress/tsconfig.cy.json');
    expect(cyTsConfig.include).toEqual([
      'support/**/*.ts',
      '../cypress.config.ts',
      '../**/*.cy.ts',
      '../**/*.cy.tsx',
      '../**/*.cy.js',
      '../**/*.cy.jsx',
      '../**/*.d.ts',
    ]);
    expect(cyTsConfig.compilerOptions.outDir).toEqual('../../../dist/out-tsc');
    const libTsConfig = readJson(tree, 'libs/cool-lib/tsconfig.lib.json');
    expect(libTsConfig.exclude).toEqual(
      expect.arrayContaining([
        'cypress/**/*',
        'cypress.config.ts',
        '**/*.cy.ts',
        '**/*.cy.js',
        '**/*.cy.tsx',
        '**/*.cy.jsx',
      ])
    );
    const baseTsConfig = readJson(tree, 'libs/cool-lib/tsconfig.json');
    expect(baseTsConfig.references).toEqual(
      expect.arrayContaining([{ path: './cypress/tsconfig.cy.json' }])
    );
  });

  it('should update cacheable operations', async () => {
    mockedInstalledCypressVersion.mockReturnValue(10);
    updateJson(tree, 'nx.json', (json) => {
      json.namedInputs = {
        production: [],
        targetDefaults: [],
      };
      return json;
    });
    await cypressComponentProject(tree, {
      project: 'cool-lib',
      skipFormat: false,
    });

    const nxJson = readJson(tree, 'nx.json');

    expect(
      nxJson.tasksRunnerOptions.default.options.cacheableOperations
    ).toEqual(expect.arrayContaining(['component-test']));
    expect(nxJson.targetDefaults['component-test']).toEqual({
      inputs: ['default', '^production'],
    });
    expect(nxJson.namedInputs.production).toEqual([
      '!{projectRoot}/cypress/**/*',
      '!{projectRoot}/**/*.cy.[jt]s?(x)',
      '!{projectRoot}/cypress.config.[jt]s',
    ]);
  });

  it('should not error when rerunning on an existing project', async () => {
    mockedInstalledCypressVersion.mockReturnValue(10);
    tree.write('libs/cool-lib/cypress.config.ts', '');
    const newTarget = {
      ['component-test']: {
        executor: '@nrwl/cypress:cypress',
        options: {
          cypressConfig: 'libs/cool-lib/cypress.config.ts',
          testingType: 'component',
        },
      },
    };
    updateProjectConfiguration(tree, 'cool-lib', {
      ...projectConfig,
      targets: {
        ...projectConfig.targets,
        ...newTarget,
      },
    });

    await cypressComponentProject(tree, {
      project: 'cool-lib',
      skipFormat: true,
    });
    const actualProjectConfig = readProjectConfiguration(tree, 'cool-lib');

    expect(tree.exists('libs/cool-lib/cypress.config.ts')).toEqual(true);
    expect(tree.exists('libs/cool-lib/cypress')).toEqual(true);
    expect(tree.exists('libs/cool-lib/cypress/tsconfig.cy.json')).toEqual(true);
    expect(actualProjectConfig.targets['component-test']).toMatchSnapshot();
  });

  it('should error when using cypress < v10', async () => {
    mockedInstalledCypressVersion.mockReturnValue(9);
    await expect(
      async () =>
        await cypressComponentProject(tree, {
          project: 'cool-lib',
          skipFormat: true,
        })
    ).rejects.toThrowError(
      'Cypress version of 10 or higher is required to use component testing. See the migration guide to upgrade. https://nx.dev/cypress/v10-migration-guide'
    );
  });
});
