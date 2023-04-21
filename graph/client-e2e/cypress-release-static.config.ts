import { defineConfig } from 'cypress';
import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
import setupNodeEvents from './src/plugins/index';

const cypressJsonConfig = {
  fileServerFolder: '.',
  fixturesFolder: './src/fixtures',
  video: true,
  videosFolder: '../../dist/cypress/graph/client-e2e/videos',
  screenshotsFolder: '../../dist/cypress/graph/client-e2e/screenshots',
  chromeWebSecurity: false,
  specPattern: './src/e2e/**/release-static*.cy.{js,jsx,ts,tsx}',
  supportFile: 'src/support/e2e.ts',
};
export default defineConfig({
  e2e: {
    ...nxE2EPreset(__dirname),
    ...cypressJsonConfig,
    setupNodeEvents,
    /**
     * TODO(@nx/cypress): In Cypress v12,the testIsolation option is turned on by default.
     * This can cause tests to start breaking where not indended.
     * You should consider enabling this once you verify tests do not depend on each other
     * More Info: https://docs.cypress.io/guides/references/migration-guide#Test-Isolation
     **/
    testIsolation: false,
  },
});
