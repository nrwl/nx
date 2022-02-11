import {
  checkFilesExist,
  killPorts,
  newProject,
  readJson,
  runCLI,
  uniq,
  createFile,
} from '@nrwl/e2e/utils';

describe('Cypress Component Test runner', () => {
  beforeAll(() => newProject());

  describe('apps', () => {
    const appName = uniq('cy-react-test-app');

    it('should add cypress component tests to existing app', () => {
      runCLI(`generate @nrwl/react:app ${appName}`);
      runCLI(
        `generate @nrwl/cypress:cy-cmp ${appName} --componentType=react --compiler=babel`
      );
      createFile(
        `apps/${appName}/src/app/app.cy.tsx`,
        `
        import React from 'react';
        import { mount } from '@cypress/react';
        import App from './app';

        describe(App.name, () => {
          it('should create', () => {
            mount(<App />);
            cy.contains(/Welcome/i);
          });
        });
        `
      );

      const packageJson = readJson('package.json');
      expect(packageJson.devDependencies['cypress']).toBeTruthy();
      checkFilesExist(`apps/${appName}/cypress.config.ts`);
      checkFilesExist(`apps/${appName}/tsconfig.cy.json`);
      checkFilesExist(`apps/${appName}/cypress/component/index.html`);
      checkFilesExist(`apps/${appName}/cypress/fixtures/example.json`);
      checkFilesExist(`apps/${appName}/cypress/support/component.ts`);
    }, 1000000);

    it('should successfully run default cypress tests', async () => {
      expect(runCLI(`test-cmp ${appName} --no-watch`)).toContain(
        'All specs passed!'
      );
      await killPorts(8080);
    }, 1000000);
  });

  describe('libs', () => {
    const libName = uniq('cy-react-test-lib');
    it('should generate w/ cypress component tests', () => {
      runCLI(`generate @nrwl/react:lib ${libName} --cy --compiler=swc`);

      checkFilesExist(`libs/${libName}/cypress.config.ts`);
      checkFilesExist(`libs/${libName}/src/lib/${libName}.cy.tsx`);
      checkFilesExist(`libs/${libName}/tsconfig.cy.json`);
      checkFilesExist(`libs/${libName}/cypress/component/index.html`);
      checkFilesExist(`libs/${libName}/cypress/fixtures/example.json`);
      checkFilesExist(`libs/${libName}/cypress/support/component.ts`);
    }, 1000000);

    it('should successfully run default cypress tests', async () => {
      expect(runCLI(`test-cmp ${libName} --no-watch`)).toContain(
        'All specs passed!'
      );
      await killPorts(8080);
    }, 1000000);
  });
});
