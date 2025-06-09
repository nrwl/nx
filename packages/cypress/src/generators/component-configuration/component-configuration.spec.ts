import 'nx/src/internal-testing-utils/mock-project-graph';

import {
  addProjectConfiguration,
  ProjectConfiguration,
  readJson,
  readNxJson,
  readProjectConfiguration,
  Tree,
  updateJson,
  updateNxJson,
  updateProjectConfiguration,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { getInstalledCypressMajorVersion } from '../../utils/versions';
import { componentConfigurationGenerator } from './component-configuration';
import { cypressInitGenerator } from '../init/init';

jest.mock('../../utils/versions', () => ({
  ...jest.requireActual('../../utils/versions'),
  getInstalledCypressMajorVersion: jest.fn(),
}));

let projectConfig: ProjectConfiguration = {
  projectType: 'library',
  sourceRoot: 'libs/cool-lib/src',
  root: 'libs/cool-lib',
  targets: {
    build: {
      executor: '@nx/rollup:rollup',
      options: {
        tsConfig: 'libs/cool-lib/tsconfig.lib.json',
      },
    },
    test: {
      executor: '@nx/jest:jest',
      options: {
        jestConfig: 'libs/cool-lib/jest.config.js',
      },
    },
  },
};
describe('Cypress Component Configuration', () => {
  let tree: Tree;
  let mockedInstalledCypressVersion: jest.Mock<
    ReturnType<typeof getInstalledCypressMajorVersion>
  > = getInstalledCypressMajorVersion as never;

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

  it('should not add the target when @nx/cypress/plugin is registered', async () => {
    await cypressInitGenerator(tree, {
      addPlugin: true,
    });
    const nxJson = readNxJson(tree);
    nxJson.namedInputs = {
      default: ['{projectRoot}/**/*'],
      production: ['default'],
    };
    updateNxJson(tree, nxJson);

    await componentConfigurationGenerator(tree, {
      project: 'cool-lib',
      skipFormat: false,
      addPlugin: true,
    });

    expect(
      readProjectConfiguration(tree, 'cool-lib').targets['component-test']
    ).toBeUndefined();

    expect(readNxJson(tree).namedInputs.production).toMatchInlineSnapshot(`
      [
        "default",
        "!{projectRoot}/cypress/**/*",
        "!{projectRoot}/**/*.cy.[jt]s?(x)",
        "!{projectRoot}/cypress.config.[jt]s",
      ]
    `);
  });

  it('should add base cypress component testing config', async () => {
    mockedInstalledCypressVersion.mockReturnValue(10);
    await componentConfigurationGenerator(tree, {
      project: 'cool-lib',
      skipFormat: false,
      jsx: true,
    });
    expect(tree.exists('libs/cool-lib/cypress.config.ts')).toEqual(true);
    expect(tree.read('libs/cool-lib/cypress.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { defineConfig } from 'cypress';

      export default defineConfig({});
      "
    `);
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

    expect(tree.exists('libs/cool-lib/cypress/tsconfig.json')).toEqual(true);
    const cyTsConfig = readJson(tree, 'libs/cool-lib/cypress/tsconfig.json');
    expect(cyTsConfig.include).toEqual([
      '**/*.ts',
      '**/*.js',
      '../cypress.config.ts',
      '../**/*.cy.ts',
      '../**/*.cy.tsx',
      '../**/*.cy.js',
      '../**/*.cy.jsx',
      '../**/*.d.ts',
    ]);
    expect(cyTsConfig.compilerOptions.outDir).toEqual('../../dist/out-tsc');
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
      expect.arrayContaining([{ path: './cypress/tsconfig.json' }])
    );
  });

  it('should exclude cypress files from the production fileset', async () => {
    mockedInstalledCypressVersion.mockReturnValue(10);
    updateJson(tree, 'nx.json', (json) => {
      json.namedInputs = {
        production: [],
        targetDefaults: [],
      };
      return json;
    });
    await componentConfigurationGenerator(tree, {
      project: 'cool-lib',
      skipFormat: false,
    });

    const nxJson = readJson(tree, 'nx.json');

    expect(nxJson.namedInputs.production).toEqual([
      '!{projectRoot}/cypress/**/*',
      '!{projectRoot}/**/*.cy.[jt]s?(x)',
      '!{projectRoot}/cypress.config.[jt]s',
    ]);
  });

  it('should not error when rerunning on an existing project', async () => {
    mockedInstalledCypressVersion.mockReturnValue(10);
    const existingConfig = `import { defineConfig } from 'cypress';
export default defineConfig({
  component: somethingElse(__filename),
});
`;
    tree.write('libs/cool-lib/cypress.config.ts', existingConfig);
    const newTarget = {
      ['component-test']: {
        executor: '@nx/cypress:cypress',
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

    await componentConfigurationGenerator(tree, {
      project: 'cool-lib',
      skipFormat: true,
    });
    const actualProjectConfig = readProjectConfiguration(tree, 'cool-lib');

    expect(tree.read('libs/cool-lib/cypress.config.ts', 'utf-8')).toEqual(
      existingConfig
    );
    expect(tree.exists('libs/cool-lib/cypress')).toEqual(true);
    expect(actualProjectConfig.targets['component-test']).toMatchSnapshot();
  });

  it('should error when using cypress < v10', async () => {
    mockedInstalledCypressVersion.mockReturnValue(9);
    await expect(
      async () =>
        await componentConfigurationGenerator(tree, {
          project: 'cool-lib',
          skipFormat: true,
        })
    ).rejects.toThrowError(
      'Cypress version of 10 or higher is required to use component testing. See the migration guide to upgrade. https://nx.dev/cypress/v11-migration-guide'
    );
  });
});
