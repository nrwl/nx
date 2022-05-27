import {
  checkFilesExist,
  killPorts,
  newProject,
  readJson,
  runCLI,
  uniq,
  updateFile,
} from '@nrwl/e2e/utils';

describe('Cypress Component Test runner', () => {
  beforeAll(() => newProject());

  describe('apps', () => {
    const appName = uniq('cy-comp-test-app');

    it('should add cypress component tests to existing app', () => {
      // react app
      runCLI(`generate @nrwl/react:app ${appName}-react --no-interactive`);
      runCLI(
        `generate @nrwl/cypress:cy-cmp --project=${appName}-react --componentType=react --compiler=babel`
      );
      runCLI(
        `generate @nrwl/cypress:cy-test --project=${appName}-react --name=app --componentType=react --dir=app`
      );
      // next app
      runCLI(`generate @nrwl/next:app ${appName}-next --no-interactive`);
      runCLI(
        `generate @nrwl/cypress:cy-cmp --project=${appName}-next --componentType=next`
      );
      // by default the cy-test file will be generated assuming next to the test file, but for next apps needs to go into the specs folder
      runCLI(
        `generate @nrwl/cypress:cy-test --project=${appName}-next --name=index --componentType=next --dir=specs`
      );
      // the file should exist but we need to update the contents for next apps specifics
      checkFilesExist(`apps/${appName}-next/specs/index.cy.tsx`);
      updateFile(
        `apps/${appName}-next/specs/index.cy.tsx`,
        `
import * as React from 'react'
import { mount } from '@cypress/react'
import Index from '../pages/index';

describe(Index.name, () => {
  it('should create', () => {
    mount(<Index />)
    cy.contains(/Welcome/i)
  })
})
`
      );

      const packageJson = readJson('package.json');
      expect(packageJson.devDependencies['cypress']).toBeTruthy();
      checkFilesExist(
        `apps/${appName}-react/cypress.config.ts`,
        `apps/${appName}-react/tsconfig.cy.json`,
        `apps/${appName}-react/cypress/component/index.html`,
        `apps/${appName}-react/cypress/fixtures/example.json`,
        `apps/${appName}-react/cypress/support/component.ts`,
        `apps/${appName}-react/src/app/app.cy.tsx`,
        `apps/${appName}-next/cypress.config.ts`,
        `apps/${appName}-next/tsconfig.cy.json`,
        `apps/${appName}-next/cypress/component/index.html`,
        `apps/${appName}-next/cypress/fixtures/example.json`,
        `apps/${appName}-next/cypress/support/component.ts`,
        `apps/${appName}-next/specs/index.cy.tsx`
      );
    }, 1000000);

    it('should successfully run default cypress tests for react', async () => {
      expect(runCLI(`component-test ${appName}-react --no-watch`)).toContain(
        'All specs passed!'
      );
      await killPorts(8080);
    }, 1000000);

    it('should successfully run default cypress tests for next', async () => {
      expect(runCLI(`component-test ${appName}-next --no-watch`)).toContain(
        'All specs passed!'
      );
      await killPorts(8080);
    }, 1000000);
  });

  describe('libs', () => {
    const libName = uniq('cy-component-test-lib');
    it('should generate w/ cypress component tests', () => {
      runCLI(
        `generate @nrwl/react:lib ${libName}-react --cy --compiler=swc --no-interactive`
      );
      runCLI(`generate @nrwl/next:lib ${libName}-next --cy --no-interactive`);

      checkFilesExist(
        `libs/${libName}-react/cypress.config.ts`,
        `libs/${libName}-react/src/lib/${libName}-react.cy.tsx`,
        `libs/${libName}-react/tsconfig.cy.json`,
        `libs/${libName}-react/cypress/component/index.html`,
        `libs/${libName}-react/cypress/fixtures/example.json`,
        `libs/${libName}-react/cypress/support/component.ts`,
        `libs/${libName}-next/cypress.config.ts`,
        `libs/${libName}-next/src/lib/${libName}-next.cy.tsx`,
        `libs/${libName}-next/tsconfig.cy.json`,
        `libs/${libName}-next/cypress/component/index.html`,
        `libs/${libName}-next/cypress/fixtures/example.json`,
        `libs/${libName}-next/cypress/support/component.ts`
      );
    }, 1000000);

    it('should successfully run default cypress tests react', async () => {
      expect(runCLI(`component-test ${libName}-react --no-watch`)).toContain(
        'All specs passed!'
      );
      await killPorts(8080);
    }, 1000000);

    it('should successfully run default cypress tests for next', async () => {
      expect(runCLI(`component-test ${libName}-next --no-watch`)).toContain(
        'All specs passed!'
      );
      await killPorts(8080);
    }, 1000000);
  });
});
