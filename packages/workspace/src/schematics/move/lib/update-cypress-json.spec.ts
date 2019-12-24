import { Tree } from '@angular-devkit/schematics';
import { UnitTestTree } from '@angular-devkit/schematics/testing';
import { readJsonInTree } from '@nrwl/workspace';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { callRule, runSchematic } from '../../../utils/testing';
import { Schema } from '../schema';
import { updateCypressJson } from './update-cypress-json';

describe('updateCypressJson Rule', () => {
  let tree: UnitTestTree;

  beforeEach(async () => {
    tree = new UnitTestTree(Tree.empty());
    tree = createEmptyWorkspace(tree) as UnitTestTree;
  });

  it('should handle cypress.json not existing', async () => {
    tree = await runSchematic('lib', { name: 'my-lib' }, tree);

    expect(tree.files).not.toContain('/libs/my-destination/cypress.json');

    const schema: Schema = {
      projectName: 'my-lib',
      destination: 'my-destination'
    };

    await expect(
      callRule(updateCypressJson(schema), tree)
    ).resolves.not.toThrow();
  });

  it('should update the videos and screenshots folders', async () => {
    const cypressJson = {
      fileServerFolder: '.',
      fixturesFolder: './src/fixtures',
      integrationFolder: './src/integration',
      pluginsFile: './src/plugins/index',
      supportFile: false,
      video: true,
      videosFolder: '../../dist/cypress/libs/my-lib/videos',
      screenshotsFolder: '../../dist/cypress/libs/my-lib/screenshots',
      chromeWebSecurity: false
    };

    tree = await runSchematic('lib', { name: 'my-lib' }, tree);
    tree.create(
      '/libs/my-destination/cypress.json',
      JSON.stringify(cypressJson)
    );

    expect(tree.files).toContain('/libs/my-destination/cypress.json');

    const schema: Schema = {
      projectName: 'my-lib',
      destination: 'my-destination'
    };

    tree = (await callRule(updateCypressJson(schema), tree)) as UnitTestTree;

    expect(readJsonInTree(tree, '/libs/my-destination/cypress.json')).toEqual({
      ...cypressJson,
      videosFolder: '../../dist/cypress/libs/my-destination/videos',
      screenshotsFolder: '../../dist/cypress/libs/my-destination/screenshots'
    });
  });
});
