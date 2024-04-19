// eslint-disable-next-line @nx/enforce-module-boundaries
import { nxE2EPreset } from '../../node_modules/@nx/cypress/plugins/cypress-preset';

export const cypressBaseConfig = {
  ...nxE2EPreset(__dirname, {
    webServerCommands: {
      dev: 'nx run graph-client:serve-base:dev-e2e',
      watch: 'nx run graph-client:serve-base:watch',
      release: 'nx run graph-client:serve-base:release',
      'release-static': 'nx run graph-client:serve-base:release-static',
    },
    ciWebServerCommand: 'nx run graph-client:serve-base:release-static',
  }),
  fileServerFolder: '.',
  fixturesFolder: './src/fixtures',
  video: true,
  videosFolder: '../../dist/cypress/graph/client-e2e/videos',
  screenshotsFolder: '../../dist/cypress/graph/client-e2e/screenshots',
  chromeWebSecurity: false,
  specPattern: 'src/e2e/**/dev-*.cy.{js,jsx,ts,tsx}',
  supportFile: 'src/support/e2e.ts',
  /**
   * TODO(@nx/cypress): In Cypress v12,the testIsolation option is turned on by default.
   * This can cause tests to start breaking where not indended.
   * You should consider enabling this once you verify tests do not depend on each other
   * More Info: https://docs.cypress.io/guides/references/migration-guide#Test-Isolation
   **/
  testIsolation: false,
};
