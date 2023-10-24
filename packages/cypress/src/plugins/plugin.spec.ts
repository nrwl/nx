import { CreateNodesContext } from '@nx/devkit';
import { defineConfig } from 'cypress';

import { createNodes, NxCypressMetadata } from './plugin';

describe('@nx/cypress/plugin', () => {
  let createNodesFunction = createNodes[1];
  let context: CreateNodesContext;

  beforeEach(async () => {
    context = {
      nxJsonConfiguration: {
        namedInputs: {
          default: ['{projectRoot}/**/*'],
          production: ['!{projectRoot}/**/*.spec.ts'],
        },
      },
      workspaceRoot: '',
    };
  });

  afterEach(() => {
    jest.resetModules();
  });

  it('should add a target for e2e', () => {
    mockCypressConfig(
      defineConfig({
        e2e: {
          videosFolder: './dist/videos',
          screenshotsFolder: './dist/screenshots',
        },
      })
    );
    const nodes = createNodesFunction(
      'cypress.config.js',
      {
        targetName: 'e2e',
      },
      context
    );

    expect(nodes).toMatchInlineSnapshot(`
      {
        "projects": {
          ".": {
            "projectType": "application",
            "root": ".",
            "targets": {
              "e2e": {
                "cache": true,
                "executor": "@nx/cypress:cypress",
                "inputs": [
                  "default",
                  "^production",
                ],
                "options": {
                  "cypressConfig": "cypress.config.js",
                  "testingType": "e2e",
                },
                "outputs": [
                  "{options.videosFolder}",
                  "{options.screenshotsFolder}",
                  "{projectRoot}/dist/videos",
                  "{projectRoot}/dist/screenshots",
                ],
              },
            },
          },
        },
      }
    `);
  });

  it('should add a target for component testing', () => {
    mockCypressConfig(
      defineConfig({
        component: {
          videosFolder: './dist/videos',
          screenshotsFolder: './dist/screenshots',
          devServer: {
            framework: 'create-react-app',
            bundler: 'webpack',
          },
        },
      })
    );
    const nodes = createNodesFunction(
      'cypress.config.js',
      {
        componentTestingTargetName: 'component-test',
      },
      context
    );

    expect(nodes).toMatchInlineSnapshot(`
      {
        "projects": {
          ".": {
            "projectType": "application",
            "root": ".",
            "targets": {
              "component-test": {
                "cache": true,
                "executor": "@nx/cypress:cypress",
                "inputs": [
                  "default",
                  "^production",
                ],
                "options": {
                  "cypressConfig": "cypress.config.js",
                  "testingType": "component",
                },
                "outputs": [
                  "{options.videosFolder}",
                  "{options.screenshotsFolder}",
                  "{projectRoot}/dist/videos",
                  "{projectRoot}/dist/screenshots",
                ],
              },
            },
          },
        },
      }
    `);
  });

  it('should use nxMetadata to create additional configurations', () => {
    mockCypressConfig(
      defineConfig({
        e2e: {},
      }),
      {
        devServerTarget: 'my-app:serve',
        productionDevServerTarget: 'my-app:serve:production',
        ciDevServerTarget: 'my-app:serve-static',
      }
    );
    const nodes = createNodesFunction(
      'cypress.config.js',
      {
        componentTestingTargetName: 'component-test',
      },
      context
    );

    expect(nodes).toMatchInlineSnapshot(`
      {
        "projects": {
          ".": {
            "projectType": "application",
            "root": ".",
            "targets": {
              "e2e": {
                "cache": true,
                "configurations": {
                  "ci": {
                    "devServerTarget": "my-app:serve-static",
                  },
                  "production": {
                    "devServerTarget": "my-app:serve:production",
                  },
                },
                "executor": "@nx/cypress:cypress",
                "inputs": [
                  "default",
                  "^production",
                ],
                "options": {
                  "cypressConfig": "cypress.config.js",
                  "devServerTarget": "my-app:serve",
                  "testingType": "e2e",
                },
                "outputs": [
                  "{options.videosFolder}",
                  "{options.screenshotsFolder}",
                ],
              },
            },
          },
        },
      }
    `);
  });
});

function mockCypressConfig(
  cypressConfig: Cypress.ConfigOptions,
  nxMetadata?: NxCypressMetadata
) {
  jest.mock(
    'cypress.config.js',
    () => ({
      default: cypressConfig,
      nx: nxMetadata,
    }),
    {
      virtual: true,
    }
  );
}
