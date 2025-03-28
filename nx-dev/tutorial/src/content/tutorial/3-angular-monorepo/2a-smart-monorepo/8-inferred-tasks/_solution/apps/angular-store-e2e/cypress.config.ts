import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    ...nxE2EPreset(__filename, {
      cypressDir: 'src',
      webServerCommands: {
        default: 'npx nx run angular-store:serve',
        production: 'npx nx run angular-store:serve-static',
      },
      ciWebServerCommand: 'npx nx run angular-store:serve-static',
      ciBaseUrl: 'http://localhost:4200',
    }),
    baseUrl: 'http://localhost:4200',
    videosFolder: '../dist/cypress/apps/angular-store-e2e/videos-changed',
    screenshotsFolder:
      '../dist/cypress/apps/angular-store-e2e/screenshots-changed',
  },
});
