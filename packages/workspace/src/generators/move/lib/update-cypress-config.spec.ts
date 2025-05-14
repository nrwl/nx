import 'nx/src/internal-testing-utils/mock-project-graph';

import {
  ProjectConfiguration,
  readJson,
  readProjectConfiguration,
  Tree,
  writeJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { NormalizedSchema } from '../schema';
import { updateCypressConfig } from './update-cypress-config';

// nx-ignore-next-line
const { libraryGenerator } = require('@nx/js');

describe('updateCypressConfig', () => {
  let tree: Tree;
  let schema: NormalizedSchema;
  let projectConfig: ProjectConfiguration;

  beforeEach(async () => {
    schema = {
      projectName: 'my-lib',
      destination: 'my-destination',
      importPath: '@proj/my-destination',
      updateImportPath: true,
      newProjectName: 'my-destination',
      relativeToRootDestination: 'my-destination',
    };

    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    await libraryGenerator(tree, {
      directory: 'my-lib',
    });
    projectConfig = readProjectConfiguration(tree, 'my-lib');
  });

  it('should handle cypress.json not existing', async () => {
    expect(() => {
      updateCypressConfig(tree, schema, projectConfig);
    }).not.toThrow();
  });

  it('should update the videos and screenshots folders', async () => {
    const cypressJson = {
      fileServerFolder: '.',
      fixturesFolder: './src/fixtures',
      integrationFolder: './src/integration',
      pluginsFile: './src/plugins/index',
      supportFile: false,
      video: true,
      videosFolder: '../../dist/cypress/my-lib/videos',
      screenshotsFolder: '../../dist/cypress/my-lib/screenshots',
      chromeWebSecurity: false,
    };
    writeJson(tree, 'my-destination/cypress.json', cypressJson);

    updateCypressConfig(tree, schema, projectConfig);

    expect(readJson(tree, 'my-destination/cypress.json')).toEqual({
      ...cypressJson,
      videosFolder: '../../dist/cypress/my-destination/videos',
      screenshotsFolder: '../../dist/cypress/my-destination/screenshots',
    });
  });

  it('should noop if the videos and screenshots folders are not defined', async () => {
    const cypressJson = {
      fileServerFolder: '.',
      fixturesFolder: './src/fixtures',
      integrationFolder: './src/integration',
      pluginsFile: './src/plugins/index',
      supportFile: false,
      video: false,
      chromeWebSecurity: false,
    };
    writeJson(tree, 'my-destination/cypress.json', cypressJson);

    updateCypressConfig(tree, schema, projectConfig);

    expect(readJson(tree, 'my-destination/cypress.json')).toEqual(cypressJson);
  });

  it('should handle updating cypress.config.ts', async () => {
    tree.write(
      'my-destination/cypress.config.ts',
      `
import { defineConfig } from 'cypress';
import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';

export default defineConfig({
  e2e: {
    ...nxE2EPreset(__dirname),
    videosFolder: '../../dist/cypress/my-lib/videos',
    screenshotsFolder: '../../dist/cypress/my-lib/screenshots',
  }
});
    `
    );

    updateCypressConfig(tree, schema, projectConfig);
    const fileContent = tree.read('my-destination/cypress.config.ts', 'utf-8');
    expect(fileContent).toContain(
      `videosFolder: '../../dist/cypress/my-destination/videos'`
    );
    expect(fileContent).toContain(
      `screenshotsFolder: '../../dist/cypress/my-destination/screenshots'`
    );
  });
});
