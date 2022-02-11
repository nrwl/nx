import { addOrUpdateConfigProperties } from './update-config';

describe('Update Cypress Config', () => {
  let configContent = `
import { defineConfig } from 'cypress';
import { componentDevServer } from '@nrwl/cypress/plugins/next';


export default defineConfig({
  component: {
    devServer: componentDevServer('tsconfig.cy.json', 'babel'),
    pluginsFile: false,
    video: true,
    chromeWebSecurity: false,
    fixturesFolder: 'cypress/fixtures',
    specPattern: '**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'cypress/support/component.ts',
    videosFolder: '../../dist/cypress/apps/n/videos',
    screenshotsFolder: '../../dist/cypress/apps/n/screenshots',
  },
  e2e: {
    fileServerFolder: '.',
    fixturesFolder: './src/fixtures',
    integrationFolder: './src/e2e',
    supportFile: './src/support/e2e.ts',
    specPattern: '**/*.cy.{js,ts}',
    pluginsFile: false,
    video: true,
    videosFolder: '../../dist/cypress/apps/myapp4299814-e2e/videos',
    screenshotsFolder: '../../dist/cypress/apps/myapp4299814-e2e/screenshots',
    chromeWebSecurity: false,
  },
});
  `;

  describe('Imports', () => {
    it('should add an import', () => {});

    it('should remove an import', () => {});

    it('should update an import', () => {});
  });

  describe('Properties', () => {
    it('should add a property', () => {
      const actual = addOrUpdateConfigProperties(configContent, {
        baseUrl: 'http://localhost:8080',
      });

      expect(actual).toMatchSnapshot();
    });

    it('should update a property', () => {});

    it('should update a nested property', () => {});

    it('should remove a property', () => {});

    it('should remove a nested property', () => {});
  });
});
