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
    expect(readJson(tree, 'apps/demo/cypress/tsconfig.json')).toMatchSnapshot();
    expect(tree.read('apps/demo/cypress.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { nxComponentTestingPreset } from '@nx/next/plugins/component-testing';
      import { defineConfig } from 'cypress';

      export default defineConfig({
        component: nxComponentTestingPreset(__filename),
      });
      "
    `);
    expect(tree.read('apps/demo/cypress/support/component.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { mount } from 'cypress/react18';
      import './styles.ct.css';
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
    expect(
      tree.read('apps/demo/cypress/support/component.ts', 'utf-8')
    ).toContain(`import './styles.ct.css';`);
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
          path: './cypress/tsconfig.json',
        },
      ])
    );
    expect(readJson(tree, 'libs/demo/cypress/tsconfig.json')).toMatchSnapshot();
    expect(tree.read('libs/demo/cypress.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { nxComponentTestingPreset } from '@nx/next/plugins/component-testing';
      import { defineConfig } from 'cypress';

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
