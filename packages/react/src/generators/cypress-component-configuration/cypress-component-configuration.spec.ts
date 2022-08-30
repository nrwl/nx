import { assertMinimumCypressVersion } from '@nrwl/cypress/src/utils/cypress-version';
import {
  DependencyType,
  ProjectGraph,
  readJson,
  readProjectConfiguration,
  Tree,
} from '@nrwl/devkit';
import { createTreeWithEmptyV1Workspace } from '@nrwl/devkit/testing';
import { Linter } from '@nrwl/linter';
import { applicationGenerator } from '../application/application';
import { componentGenerator } from '../component/component';
import { libraryGenerator } from '../library/library';
import { cypressComponentConfigGenerator } from './cypress-component-configuration';

let projectGraph: ProjectGraph;
jest.mock('@nrwl/devkit', () => ({
  ...jest.requireActual<any>('@nrwl/devkit'),
  createProjectGraphAsync: jest
    .fn()
    .mockImplementation(async () => projectGraph),
}));
jest.mock('@nrwl/cypress/src/utils/cypress-version');
describe('React:CypressComponentTestConfiguration', () => {
  let tree: Tree;
  let mockedAssertCypressVersion: jest.Mock<
    ReturnType<typeof assertMinimumCypressVersion>
  > = assertMinimumCypressVersion as never;
  beforeEach(() => {
    tree = createTreeWithEmptyV1Workspace();
  });
  it('should generate cypress component test config with --build-target', async () => {
    mockedAssertCypressVersion.mockReturnValue();

    await applicationGenerator(tree, {
      e2eTestRunner: 'none',
      linter: Linter.EsLint,
      skipFormat: true,
      style: 'scss',
      unitTestRunner: 'none',
      name: 'my-app',
    });
    await libraryGenerator(tree, {
      linter: Linter.EsLint,
      name: 'some-lib',
      skipFormat: true,
      skipTsConfig: false,
      style: 'scss',
      unitTestRunner: 'none',
      component: true,
    });
    // --build-target still needs to build the graph in order for readTargetOptions to work
    projectGraph = {
      nodes: {
        'my-app': {
          name: 'my-app',
          type: 'app',
          data: {
            ...readProjectConfiguration(tree, 'my-app'),
          },
        },
        'some-lib': {
          name: 'some-lib',
          type: 'lib',
          data: {
            ...readProjectConfiguration(tree, 'some-lib'),
          },
        },
      },
      dependencies: {
        'my-app': [
          { type: DependencyType.static, source: 'my-app', target: 'some-lib' },
        ],
      },
    };
    await cypressComponentConfigGenerator(tree, {
      project: 'some-lib',
      generateTests: false,
      buildTarget: 'my-app:build',
    });

    const config = tree.read('libs/some-lib/cypress.config.ts', 'utf-8');
    expect(config).toContain(
      "import { nxComponentTestingPreset } from '@nrwl/react/plugins/component-testing"
    );
    expect(config).toContain(
      'component: nxComponentTestingPreset(__filename),'
    );

    const cyTsConfig = readJson(tree, 'libs/some-lib/tsconfig.cy.json');
    expect(cyTsConfig.include).toEqual([
      'cypress.config.ts',
      '**/*.cy.ts',
      '**/*.cy.tsx',
      '**/*.cy.js',
      '**/*.cy.jsx',
      '**/*.d.ts',
    ]);
    const libTsConfig = readJson(tree, 'libs/some-lib/tsconfig.lib.json');
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
    const baseTsConfig = readJson(tree, 'libs/some-lib/tsconfig.json');
    expect(baseTsConfig.references).toEqual(
      expect.arrayContaining([{ path: './tsconfig.cy.json' }])
    );
    expect(
      readProjectConfiguration(tree, 'some-lib').targets['component-test']
    ).toEqual({
      executor: '@nrwl/cypress:cypress',
      options: {
        cypressConfig: 'libs/some-lib/cypress.config.ts',
        devServerTarget: 'my-app:build',
        skipServe: true,
        testingType: 'component',
      },
    });
  });

  it('should generate cypress component test config with project graph', async () => {
    mockedAssertCypressVersion.mockReturnValue();
    await applicationGenerator(tree, {
      e2eTestRunner: 'none',
      linter: Linter.EsLint,
      skipFormat: true,
      style: 'scss',
      unitTestRunner: 'none',
      name: 'my-app',
    });
    await libraryGenerator(tree, {
      linter: Linter.EsLint,
      name: 'some-lib',
      skipFormat: true,
      skipTsConfig: false,
      style: 'scss',
      unitTestRunner: 'none',
      component: true,
    });

    projectGraph = {
      nodes: {
        'my-app': {
          name: 'my-app',
          type: 'app',
          data: {
            ...readProjectConfiguration(tree, 'my-app'),
          },
        },
        'some-lib': {
          name: 'some-lib',
          type: 'lib',
          data: {
            ...readProjectConfiguration(tree, 'some-lib'),
          },
        },
      },
      dependencies: {
        'my-app': [
          { type: DependencyType.static, source: 'my-app', target: 'some-lib' },
        ],
      },
    };

    await cypressComponentConfigGenerator(tree, {
      project: 'some-lib',
      generateTests: false,
    });

    const config = tree.read('libs/some-lib/cypress.config.ts', 'utf-8');
    expect(config).toContain(
      "import { nxComponentTestingPreset } from '@nrwl/react/plugins/component-testing"
    );
    expect(config).toContain(
      'component: nxComponentTestingPreset(__filename),'
    );

    const cyTsConfig = readJson(tree, 'libs/some-lib/tsconfig.cy.json');
    expect(cyTsConfig.include).toEqual([
      'cypress.config.ts',
      '**/*.cy.ts',
      '**/*.cy.tsx',
      '**/*.cy.js',
      '**/*.cy.jsx',
      '**/*.d.ts',
    ]);
    const libTsConfig = readJson(tree, 'libs/some-lib/tsconfig.lib.json');
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
    const baseTsConfig = readJson(tree, 'libs/some-lib/tsconfig.json');
    expect(baseTsConfig.references).toEqual(
      expect.arrayContaining([{ path: './tsconfig.cy.json' }])
    );
    expect(
      readProjectConfiguration(tree, 'some-lib').targets['component-test']
    ).toEqual({
      executor: '@nrwl/cypress:cypress',
      options: {
        cypressConfig: 'libs/some-lib/cypress.config.ts',
        devServerTarget: 'my-app:build',
        skipServe: true,
        testingType: 'component',
      },
    });
  });

  it('should generate tests for existing tsx components', async () => {
    mockedAssertCypressVersion.mockReturnValue();
    await applicationGenerator(tree, {
      e2eTestRunner: 'none',
      linter: Linter.EsLint,
      skipFormat: true,
      style: 'scss',
      unitTestRunner: 'none',
      name: 'my-app',
    });
    await libraryGenerator(tree, {
      linter: Linter.EsLint,
      name: 'some-lib',
      skipFormat: true,
      skipTsConfig: false,
      style: 'scss',
      unitTestRunner: 'jest',
      component: true,
    });
    await componentGenerator(tree, {
      name: 'another-cmp',
      project: 'some-lib',
      style: 'scss',
    });

    await cypressComponentConfigGenerator(tree, {
      project: 'some-lib',
      generateTests: true,
      buildTarget: 'my-app:build',
    });

    expect(tree.exists('libs/some-lib/src/lib/some-lib.cy.tsx')).toBeTruthy();
    const compTest = tree.read(
      'libs/some-lib/src/lib/some-lib.cy.tsx',
      'utf-8'
    );
    expect(compTest).toMatchSnapshot();
    expect(tree.exists('libs/some-lib/src/lib/some-lib.cy.tsx')).toBeTruthy();
    const compTestNested = tree.read(
      'libs/some-lib/src/lib/another-cmp/another-cmp.cy.tsx',
      'utf-8'
    );
    expect(compTestNested).toMatchSnapshot();
    expect(
      tree.exists('libs/some-lib/src/lib/another-cmp/another-cmp.spec.cy.tsx')
    ).toBeFalsy();
  });
  it('should generate tests for existing js components', async () => {
    mockedAssertCypressVersion.mockReturnValue();
    await applicationGenerator(tree, {
      e2eTestRunner: 'none',
      linter: Linter.EsLint,
      skipFormat: true,
      style: 'scss',
      unitTestRunner: 'none',
      name: 'my-app',
    });
    await libraryGenerator(tree, {
      linter: Linter.EsLint,
      name: 'some-lib',
      skipFormat: true,
      skipTsConfig: false,
      style: 'scss',
      unitTestRunner: 'jest',
      js: true,
    });
    await componentGenerator(tree, {
      name: 'some-cmp',
      flat: true,
      project: 'some-lib',
      style: 'scss',
      js: true,
    });
    await componentGenerator(tree, {
      name: 'another-cmp',
      project: 'some-lib',
      style: 'scss',
      js: true,
    });

    await cypressComponentConfigGenerator(tree, {
      project: 'some-lib',
      generateTests: true,
      buildTarget: 'my-app:build',
    });

    expect(tree.exists('libs/some-lib/src/lib/some-cmp.cy.js')).toBeTruthy();
    const compTest = tree.read('libs/some-lib/src/lib/some-cmp.cy.js', 'utf-8');
    expect(compTest).toMatchSnapshot();
    expect(
      tree.exists('libs/some-lib/src/lib/another-cmp/another-cmp.cy.js')
    ).toBeTruthy();
    const compTestNested = tree.read(
      'libs/some-lib/src/lib/another-cmp/another-cmp.cy.js',
      'utf-8'
    );
    expect(compTestNested).toMatchSnapshot();
    expect(
      tree.exists('libs/some-lib/src/lib/another-cmp/another-cmp.spec.cy.js')
    ).toBeFalsy();
  });
});
