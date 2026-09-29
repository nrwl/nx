import '@nx/devkit/internal-testing-utils/mock-project-graph';

import {
  joinPathFragments,
  readProjectConfiguration,
  readNxJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import libraryGenerator from '../library/library.impl';
import cypressComponentConfigurationGenerator from './cypress-component-configuration.impl';

describe('CypressComponentConfiguration', () => {
  it('should create the cypress configuration correctly', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    await libraryGenerator(tree, {
      directory: 'cypress-test',
      unitTestRunner: 'vitest',
      style: 'css',
      addPlugin: false,
    });

    // ACT
    await cypressComponentConfigurationGenerator(tree, {
      project: 'cypress-test',
      generateTests: true,
      addPlugin: false,
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
    expect(project.targets['component-test']).toBeUndefined();
    expect(readNxJson(tree).plugins).toContainEqual(
      expect.objectContaining({ plugin: '@nx/cypress/plugin' })
    );
    expect(
      tree.exists(joinPathFragments(project.root, 'cypress'))
    ).toBeTruthy();
  });
});
