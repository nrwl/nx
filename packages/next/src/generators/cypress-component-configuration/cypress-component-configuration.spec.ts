import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { readJson, readProjectConfiguration, Tree } from '@nx/devkit';
import { cypressComponentConfiguration } from './cypress-component-configuration';
import { applicationGenerator } from '../application/application';
import { libraryGenerator } from '../library/library';
import { setupTailwindGenerator } from '@nx/react';
import { Linter } from '@nx/linter';

describe('cypress-component-configuration generator', () => {
  let tree: any;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should setup nextjs app', async () => {
    await applicationGenerator(tree, { name: 'demo', style: 'css' });
    await cypressComponentConfiguration(tree, {
      generateTests: true,
      project: 'demo',
    });
    expect(readJson(tree, 'apps/demo/tsconfig.json').exclude).toEqual(
      expect.arrayContaining([
        'cypress/**/*',
        'cypress.config.ts',
        '**/*.cy.ts',
        '**/*.cy.js',
        '**/*.cy.tsx',
        '**/*.cy.jsx',
      ])
    );
    expect(
      readJson(tree, 'apps/demo/cypress/tsconfig.cy.json')
    ).toMatchSnapshot();
    expect(tree.read('apps/demo/cypress.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { defineConfig } from 'cypress';
      import { nxComponentTestingPreset } from '@nx/next/plugins/component-testing';

      export default defineConfig({
        component: nxComponentTestingPreset(__filename),
      });
      "
    `);
    expect(tree.exists('apps/demo/pages/index.cy.ts')).toBeFalsy();
    expect(
      readProjectConfiguration(tree, 'demo').targets['component-test']
    ).toEqual({
      executor: '@nx/cypress:cypress',
      options: {
        cypressConfig: 'apps/demo/cypress.config.ts',
        skipServe: true,
        testingType: 'component',
      },
    });
  });

  it('should add styles setup in app', async () => {
    await applicationGenerator(tree, { name: 'demo', style: 'css' });
    await setupTailwindGenerator(tree, { project: 'demo' });
    await cypressComponentConfiguration(tree, {
      generateTests: false,
      project: 'demo',
    });

    expect(tree.read('apps/demo/cypress/support/styles.ct.css', 'utf-8'))
      .toMatchInlineSnapshot(`
      "/* This is where you can load global styles to apply to all components. */
      @tailwind base;
      @tailwind components;
      @tailwind utilities;
      "
    `);
    expect(tree.read('apps/demo/cypress/support/component.ts', 'utf-8'))
      .toContain(`import './commands';
import './styles.ct.css';`);
  });

  it('should setup nextjs lib', async () => {
    await libraryGenerator(tree, {
      name: 'demo',
      linter: Linter.EsLint,
      style: 'css',
      unitTestRunner: 'jest',
      component: true,
    });
    await cypressComponentConfiguration(tree, {
      generateTests: true,
      project: 'demo',
    });
    expect(readJson(tree, 'libs/demo/tsconfig.json').references).toEqual(
      expect.arrayContaining([
        {
          path: './cypress/tsconfig.cy.json',
        },
      ])
    );
    expect(
      readJson(tree, 'libs/demo/cypress/tsconfig.cy.json')
    ).toMatchSnapshot();
    expect(tree.read('libs/demo/cypress.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { defineConfig } from 'cypress';
      import { nxComponentTestingPreset } from '@nx/next/plugins/component-testing';

      export default defineConfig({
        component: nxComponentTestingPreset(__filename),
      });
      "
    `);
    expect(tree.exists('libs/demo/pages/index.cy.ts')).toBeFalsy();
    expect(
      readProjectConfiguration(tree, 'demo').targets['component-test']
    ).toEqual({
      executor: '@nx/cypress:cypress',
      options: {
        cypressConfig: 'libs/demo/cypress.config.ts',
        skipServe: true,
        testingType: 'component',
      },
    });
  });
});
