import { joinPathFragments, readProjectConfiguration } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import libraryGenerator from '../library/library.impl';
import cypressComponentConfigurationGenerator from './cypress-component-configuration.impl';

describe('CypressComponentConfiguration', () => {
  // TODO(@colum): Turn this back to adding the plugin
  let originalEnv: string;

  beforeEach(() => {
    originalEnv = process.env.NX_ADD_PLUGINS;
    process.env.NX_ADD_PLUGINS = 'false';
  });

  afterEach(() => {
    process.env.NX_ADD_PLUGINS = originalEnv;
  });

  it('should create the cypress configuration correctly', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    await libraryGenerator(tree, {
      name: 'cypress-test',
      unitTestRunner: 'vitest',
      style: 'css',
      addPlugin: true,
    });

    // ACT
    await cypressComponentConfigurationGenerator(tree, {
      project: 'cypress-test',
      generateTests: true,
      addPlugin: true,
    });

    // ASSERT
    const project = readProjectConfiguration(tree, 'cypress-test');
    expect(
      tree.read(joinPathFragments(project.root, 'cypress.config.ts'), 'utf-8')
    ).toMatchInlineSnapshot(`
      "import { defineConfig } from 'cypress';
      import { nxComponentTestingPreset } from '@nx/remix/plugins/component-testing';

      export default defineConfig({
        component: nxComponentTestingPreset(__filename),
      });
      "
    `);
    expect(project.targets['component-test']).toMatchInlineSnapshot(`
      {
        "executor": "@nx/cypress:cypress",
        "options": {
          "cypressConfig": "cypress-test/cypress.config.ts",
          "devServerTarget": "",
          "skipServe": true,
          "testingType": "component",
        },
      }
    `);
    expect(
      tree.exists(joinPathFragments(project.root, 'cypress'))
    ).toBeTruthy();
  });
});
