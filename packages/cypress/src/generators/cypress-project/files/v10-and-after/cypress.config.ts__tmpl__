import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    fileServerFolder: '.',
    fixturesFolder: 'src/fixtures',
    integrationFolder: 'src/e2e',
    supportFile: 'src/support/e2e.<%= ext %>',
    specPattern: 'src/**/*.cy.{js,ts}',
    pluginsFile: false,
    video: true,
    videosFolder: '<%= offsetFromRoot %>dist/cypress/<%= projectRoot %>/videos',
    screenshotsFolder:
      '<%= offsetFromRoot %>dist/cypress/<%= projectRoot %>/screenshots',
    chromeWebSecurity: false,
  },
});
