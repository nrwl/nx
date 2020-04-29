import { chain, Tree } from '@angular-devkit/schematics';

import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { callRule, runMigration } from '../../utils/testing';
import {
  updateWorkspace,
  readJsonInTree,
  updateJsonInTree,
} from '@nrwl/workspace';

describe('Update 8.2.0', () => {
  let initialTree: Tree;

  beforeEach(async () => {
    initialTree = createEmptyWorkspace(Tree.empty());
    initialTree = await callRule(
      chain([
        updateWorkspace((workspace) => {
          workspace.projects.add({
            root: 'project',
            name: 'proejct',
            targets: {
              e2e: {
                builder: '@nrwl/cypress:cypress',
                options: {
                  cypressConfig: 'project/cypress.json',
                  tsConfig: 'project/tsconfig.e2e.json',
                  devServerTarget: 'project:serve',
                },
                configurations: {
                  production: {
                    cypressConfig: 'project/cypress.prod.json',
                    tsConfig: 'project/tsconfig.e2e.json',
                    devServerTarget: 'project:serve:production',
                  },
                },
              },
            },
          });
        }),
        updateJsonInTree('project/cypress.json', () => ({
          fileServerFolder: '../dist/out-tsc/project',
          fixturesFolder: '../dist/out-tsc/project/src/fixtures',
          integrationFolder: '../dist/out-tsc/project/src/integration',
          pluginsFile: '../dist/out-tsc/project/src/plugins/index.js',
          supportFile: false,
          video: true,
          videosFolder: '../dist/out-tsc/project/videos',
          screenshotsFolder: '../dist/out-tsc/project/screenshots',
        })),
        updateJsonInTree('project/cypress.prod.json', () => ({
          fileServerFolder: '../dist/out-tsc/project',
          fixturesFolder: '../dist/out-tsc/project/src/fixtures',
          integrationFolder: '../dist/out-tsc/project/src/integration',
          pluginsFile: '../dist/out-tsc/project/src/plugins/index.js',
          supportFile: false,
          video: true,
          videosFolder: '../dist/out-tsc/project/videos',
          screenshotsFolder: '../dist/out-tsc/project/screenshots',
          baseUrl: 'https://www.example.com',
        })),
        updateJsonInTree('project/tsconfig.e2e.json', () => ({
          extends: '../tsconfig.json',
          compilerOptions: {
            outDir: '../dist/out-tsc',
          },
          include: ['**/*'],
        })),
        updateJsonInTree('tsconfig.json', () => ({
          compilerOptions: {
            rootDir: '.',
          },
        })),
        (host) => {
          host.create(
            'project/src/plugins/index.ts',
            `
              import * as mod from 'module';

              // ***********************************************************
              // This example plugins/index.js can be used to load plugins
              //
              // You can change the location of this file or turn off loading
              // the plugins file with the 'pluginsFile' configuration option.
              //
              // You can read more here:
              // https://on.cypress.io/plugins-guide
              // ***********************************************************
              
              // This function is called when a project is opened or re-opened (e.g. due to
              // the project's config changing)
              
              module.exports = (on: Cypress.Actions, config: Cypress.ConfigOptions) => {
                console.log(mod);
                // \`on\` is used to hook into various events Cypress emits
                // \`config\` is the resolved Cypress config
              };

            `
          );
        },
      ]),
      initialTree
    );
  });

  it('should update cypress configs', async () => {
    const result = await runMigration('update-8.2.0', {}, initialTree);
    expect(readJsonInTree(result, 'project/cypress.json')).toEqual({
      fileServerFolder: './',
      fixturesFolder: './src/fixtures',
      integrationFolder: './src/integration',
      pluginsFile: './src/plugins/index.js',
      supportFile: false,
      video: true,
      videosFolder: '../dist/out-tsc/project/videos',
      screenshotsFolder: '../dist/out-tsc/project/screenshots',
    });
    expect(readJsonInTree(result, 'project/cypress.prod.json')).toEqual({
      fileServerFolder: './',
      fixturesFolder: './src/fixtures',
      integrationFolder: './src/integration',
      pluginsFile: './src/plugins/index.js',
      supportFile: false,
      video: true,
      videosFolder: '../dist/out-tsc/project/videos',
      screenshotsFolder: '../dist/out-tsc/project/screenshots',
      baseUrl: 'https://www.example.com',
    });
  });

  it('should transpile plugin files', async () => {
    const result = await runMigration('update-8.2.0', {}, initialTree);
    const newPluginsFile = result.readContent('project/src/plugins/index.js');
    expect(newPluginsFile).toContain(
      'module.exports = function (on, config) {'
    );
    expect(newPluginsFile).toContain(
      `const { preprocessTypescript } = require('@nrwl/cypress/plugins/preprocessor');`
    );
    expect(newPluginsFile).toContain(`var mod = require('module');`);
    expect(newPluginsFile).toContain(
      `on('file:preprocessor', preprocessTypescript(config));`
    );
  });
});
