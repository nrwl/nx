import { assertMinimumCypressVersion } from '@nx/cypress/src/utils/cypress-version';
import {
  DependencyType,
  ProjectGraph,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Linter } from '@nx/linter';
import { applicationGenerator } from '../application/application';
import { componentGenerator } from '../component/component';
import { libraryGenerator } from '../library/library';
import { cypressComponentConfigGenerator } from './cypress-component-configuration';

let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual<any>('@nx/devkit'),
  readTargetOptions: jest.fn().mockImplementation(() => ({})),
  createProjectGraphAsync: jest
    .fn()
    .mockImplementation(async () => projectGraph),
}));
jest.mock('@nx/cypress/src/utils/cypress-version');
// nested code imports graph from the repo, which might have innacurate graph version
jest.mock('nx/src/project-graph/project-graph', () => ({
  ...jest.requireActual<any>('nx/src/project-graph/project-graph'),
  readCachedProjectGraph: jest.fn().mockImplementation(() => projectGraph),
}));

describe('React:CypressComponentTestConfiguration', () => {
  let tree: Tree;
  let mockedAssertCypressVersion: jest.Mock<
    ReturnType<typeof assertMinimumCypressVersion>
  > = assertMinimumCypressVersion as never;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should generate cypress config with vite', async () => {
    mockedAssertCypressVersion.mockReturnValue();

    await applicationGenerator(tree, {
      e2eTestRunner: 'none',
      linter: Linter.EsLint,
      skipFormat: true,
      style: 'scss',
      unitTestRunner: 'none',
      name: 'my-app',
      bundler: 'vite',
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
          } as any,
        },
        'some-lib': {
          name: 'some-lib',
          type: 'lib',
          data: {
            ...readProjectConfiguration(tree, 'some-lib'),
          } as any,
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
    expect(config).toMatchSnapshot();
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
      bundler: 'vite',
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
          } as any,
        },
        'some-lib': {
          name: 'some-lib',
          type: 'lib',
          data: {
            ...readProjectConfiguration(tree, 'some-lib'),
          } as any,
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
    expect(config).toMatchSnapshot();

    expect(
      readProjectConfiguration(tree, 'some-lib').targets['component-test']
    ).toEqual({
      executor: '@nx/cypress:cypress',
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
      bundler: 'vite',
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
          } as any,
        },
        'some-lib': {
          name: 'some-lib',
          type: 'lib',
          data: {
            ...readProjectConfiguration(tree, 'some-lib'),
          } as any,
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
    expect(config).toMatchSnapshot();

    expect(
      readProjectConfiguration(tree, 'some-lib').targets['component-test']
    ).toEqual({
      executor: '@nx/cypress:cypress',
      options: {
        cypressConfig: 'libs/some-lib/cypress.config.ts',
        devServerTarget: 'my-app:build',
        skipServe: true,
        testingType: 'component',
      },
    });
  });

  it('should generate cypress component test config with webpack', async () => {
    mockedAssertCypressVersion.mockReturnValue();
    await applicationGenerator(tree, {
      e2eTestRunner: 'none',
      linter: Linter.EsLint,
      skipFormat: true,
      style: 'scss',
      unitTestRunner: 'none',
      name: 'my-app',
      bundler: 'webpack',
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
          } as any,
        },
        'some-lib': {
          name: 'some-lib',
          type: 'lib',
          data: {
            ...readProjectConfiguration(tree, 'some-lib'),
          } as any,
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
    expect(config).toMatchSnapshot();

    expect(
      readProjectConfiguration(tree, 'some-lib').targets['component-test']
    ).toEqual({
      executor: '@nx/cypress:cypress',
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
      bundler: 'vite',
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
      bundler: 'vite',
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

  it('should not throw error when an invalid --build-target is provided', async () => {
    mockedAssertCypressVersion.mockReturnValue();
    await applicationGenerator(tree, {
      e2eTestRunner: 'none',
      linter: Linter.EsLint,
      skipFormat: true,
      style: 'scss',
      unitTestRunner: 'none',
      name: 'my-app',
      bundler: 'vite',
    });
    await libraryGenerator(tree, {
      name: 'some-lib',
      style: 'scss',
      unitTestRunner: 'none',
      linter: Linter.None,
      skipFormat: false,
      skipTsConfig: false,
    });
    const appConfig = readProjectConfiguration(tree, 'my-app');
    appConfig.targets['build'].executor = 'something/else';
    updateProjectConfiguration(tree, 'my-app', appConfig);
    projectGraph = {
      nodes: {
        'my-app': {
          name: 'my-app',
          type: 'app',
          data: {
            ...appConfig,
          } as any,
        },
        'some-lib': {
          name: 'some-lib',
          type: 'lib',
          data: {
            ...readProjectConfiguration(tree, 'some-lib'),
          } as any,
        },
      },
      dependencies: {},
    };
    await expect(async () => {
      await cypressComponentConfigGenerator(tree, {
        project: 'some-lib',
        generateTests: true,
        buildTarget: 'my-app:build',
      });
    }).resolves;
    expect(
      require('@nx/devkit').createProjectGraphAsync
    ).not.toHaveBeenCalled();
  });

  it('should setup cypress config files correctly', async () => {
    mockedAssertCypressVersion.mockReturnValue();

    await applicationGenerator(tree, {
      e2eTestRunner: 'none',
      linter: Linter.EsLint,
      skipFormat: true,
      style: 'scss',
      unitTestRunner: 'none',
      name: 'my-app',
      bundler: 'vite',
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
          } as any,
        },
        'some-lib': {
          name: 'some-lib',
          type: 'lib',
          data: {
            ...readProjectConfiguration(tree, 'some-lib'),
          } as any,
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
    expect(config).toMatchInlineSnapshot(`
      "import { nxComponentTestingPreset } from '@nx/react/plugins/component-testing';
      import { defineConfig } from 'cypress';

      export default defineConfig({
        component: nxComponentTestingPreset(__filename, { bundler: 'vite' }),
      });
      "
    `);
    expect(tree.read('libs/some-lib/cypress/support/component.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { mount } from 'cypress/react18';
      // ***********************************************************
      // This example support/component.ts is processed and
      // loaded automatically before your test files.
      //
      // This is a great place to put global configuration and
      // behavior that modifies Cypress.
      //
      // You can change the location of this file or turn off
      // automatically serving support files with the
      // 'supportFile' configuration option.
      //
      // You can read more here:
      // https://on.cypress.io/configuration
      // ***********************************************************

      // Import commands.ts using ES2015 syntax:
      import './commands';

      // add component testing only related command here, such as mount
      declare global {
        // eslint-disable-next-line @typescript-eslint/no-namespace
        namespace Cypress {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          interface Chainable<Subject> {
            mount: typeof mount;
          }
        }
      }

      Cypress.Commands.add('mount', mount);
      "
    `);
  });
});
