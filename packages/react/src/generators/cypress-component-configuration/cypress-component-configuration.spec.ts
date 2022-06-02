import { assertMinimumCypressVersion } from '@nrwl/cypress/src/utils/cypress-version';
import { readJson, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { Linter } from '@nrwl/linter';
import { componentGenerator, libraryGenerator } from '@nrwl/react';
import { cypressComponentConfigurationGenerator } from './cypress-component-configuration';

jest.mock('@nrwl/cypress/src/utils/cypress-version');
describe(cypressComponentConfigurationGenerator.name, () => {
  let tree: Tree;
  let mockedAssertCypressVersion: jest.Mock<
    ReturnType<typeof assertMinimumCypressVersion>
  > = assertMinimumCypressVersion as never;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });
  it('should generate cypress component test config', async () => {
    mockedAssertCypressVersion.mockReturnValue();

    await libraryGenerator(tree, {
      linter: Linter.EsLint,
      name: 'some-lib',
      skipFormat: true,
      skipTsConfig: false,
      style: 'scss',
      unitTestRunner: 'none',
      component: true,
    });

    await cypressComponentConfigurationGenerator(tree, {
      project: 'some-lib',
      generateTests: false,
    });

    const config = tree.read('libs/some-lib/cypress.config.ts', 'utf-8');

    expect(config).toContain('component: nxComponentTestingPreset(__dirname),');

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
  });

  it('should generate tests for existing tsx components', async () => {
    mockedAssertCypressVersion.mockReturnValue();

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

    await cypressComponentConfigurationGenerator(tree, {
      project: 'some-lib',
      generateTests: true,
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

    await cypressComponentConfigurationGenerator(tree, {
      project: 'some-lib',
      generateTests: true,
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
