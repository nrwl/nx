import { assertMinimumCypressVersion } from '@nrwl/cypress/src/utils/cypress-version';
import { readJson, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { Linter } from '@nrwl/linter';
import { applicationGenerator } from '../application/application';
import { componentGenerator } from '../component/component';
import { libraryGenerator } from '../library/library';
import { cypressComponentConfigGenerator } from './cypress-component-configuration';

jest.mock('@nrwl/cypress/src/utils/cypress-version');
describe('Next:CypressComponentTestConfiguration', () => {
  let tree: Tree;
  let mockedAssertCypressVersion: jest.Mock<
    ReturnType<typeof assertMinimumCypressVersion>
  > = assertMinimumCypressVersion as never;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    mockedAssertCypressVersion.mockReturnValue();
  });

  it('should generate cypress component test config for next lib', async () => {
    await libraryGenerator(tree, {
      linter: Linter.EsLint,
      name: 'my-next-lib',
      skipFormat: true,
      skipTsConfig: false,
      style: 'scss',
      unitTestRunner: 'none',
      component: true,
    });

    await cypressComponentConfigGenerator(tree, {
      project: 'my-next-lib',
      generateTests: false,
    });

    const config = tree.read('libs/my-next-lib/cypress.config.ts', 'utf-8');
    expect(config).toBeTruthy();
    expect(config).toContain(
      "import { nxComponentTestingPreset } from '@nrwl/next/plugins/component-testing';"
    );
    expect(config).toContain('component: nxComponentTestingPreset(__dirname),');

    const cyTsConfig = readJson(tree, 'libs/my-next-lib/tsconfig.cy.json');
    expect(cyTsConfig.include).toEqual([
      'cypress.config.ts',
      '**/*.cy.ts',
      '**/*.cy.tsx',
      '**/*.cy.js',
      '**/*.cy.jsx',
      '**/*.d.ts',
    ]);
    const libTsConfig = readJson(tree, 'libs/my-next-lib/tsconfig.lib.json');
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
    const baseTsConfig = readJson(tree, 'libs/my-next-lib/tsconfig.json');
    expect(baseTsConfig.references).toEqual(
      expect.arrayContaining([{ path: './tsconfig.cy.json' }])
    );
  });

  it('should generate cypress component test config for next app', async () => {
    await applicationGenerator(tree, {
      name: 'my-next-app',
      e2eTestRunner: 'none',
      style: 'scss',
    });

    await cypressComponentConfigGenerator(tree, {
      project: 'my-next-app',
      generateTests: false,
    });

    const config = tree.read('apps/my-next-app/cypress.config.ts', 'utf-8');
    expect(config).toBeTruthy();
    expect(config).toContain(
      "import { nxComponentTestingPreset } from '@nrwl/next/plugins/component-testing';"
    );
    expect(config).toContain('component: nxComponentTestingPreset(__dirname),');

    const cyTsConfig = readJson(tree, 'apps/my-next-app/tsconfig.cy.json');
    expect(cyTsConfig.include).toEqual([
      'cypress.config.ts',
      '**/*.cy.ts',
      '**/*.cy.tsx',
      '**/*.cy.js',
      '**/*.cy.jsx',
      '**/*.d.ts',
    ]);
    const baseTsConfig = readJson(tree, 'apps/my-next-app/tsconfig.json');
    expect(baseTsConfig.references).toBeFalsy();
    expect(baseTsConfig.exclude).toEqual(
      expect.arrayContaining([
        'cypress/**/*',
        'cypress.config.ts',
        '**/*.cy.ts',
        '**/*.cy.js',
        '**/*.cy.tsx',
        '**/*.cy.jsx',
      ])
    );
  });

  it('should generate component tests for Next lib components', async () => {
    await libraryGenerator(tree, {
      linter: Linter.EsLint,
      name: 'my-next-lib',
      skipFormat: true,
      skipTsConfig: false,
      style: 'scss',
      unitTestRunner: 'none',
      component: true,
    });

    await componentGenerator(tree, {
      name: 'fancy-comp',
      project: 'my-next-lib',
      style: 'scss',
    });

    await cypressComponentConfigGenerator(tree, {
      project: 'my-next-lib',
      generateTests: true,
    });

    expect(
      tree.exists('libs/my-next-lib/src/lib/fancy-comp/fancy-comp.cy.tsx')
    ).toBeTruthy();
    expect(
      tree.exists('libs/my-next-lib/src/lib/fancy-comp/fancy-comp.spec.cy.tsx')
    ).toBeFalsy();
    expect(
      tree.exists('libs/my-next-lib/src/lib/my-next-lib.cy.tsx')
    ).toBeTruthy();
  });

  it('should generate component tests for Next app components', async () => {
    await applicationGenerator(tree, {
      linter: Linter.EsLint,
      name: 'my-next-app',
      skipFormat: true,
      style: 'scss',
      unitTestRunner: 'none',
    });

    await componentGenerator(tree, {
      directory: 'components',
      name: 'fancy-comp',
      project: 'my-next-app',
      style: 'scss',
    });

    await cypressComponentConfigGenerator(tree, {
      project: 'my-next-app',
      generateTests: true,
    });

    expect(
      tree.exists('apps/my-next-app/components/fancy-comp/fancy-comp.cy.tsx')
    ).toBeTruthy();
    expect(
      tree.exists(
        'apps/my-next-app/components/fancy-comp/fancy-comp.spec.cy.tsx'
      )
    ).toBeFalsy();
    expect(tree.exists('apps/my-next-app/pages/index.cy.tsx')).toBeTruthy();
  });
});
