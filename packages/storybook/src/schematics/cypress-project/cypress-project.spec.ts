import { Tree } from '@angular-devkit/schematics';
import { readJsonInTree, getProjectConfig } from '@nrwl/workspace';
import { createTestUILib, runSchematic } from '../../utils/testing';

describe('schematic:cypress-project', () => {
  let appTree: Tree;

  beforeEach(async () => {
    appTree = await createTestUILib('test-ui-lib', '@nrwl/angular');
  });

  it('should generate files', async () => {
    const tree = await runSchematic(
      'cypress-project',
      { name: 'test-ui-lib' },
      appTree
    );

    expect(tree.exists('apps/test-ui-lib-e2e/cypress.json')).toBeTruthy();
    const cypressJson = readJsonInTree(
      tree,
      'apps/test-ui-lib-e2e/cypress.json'
    );
    expect(cypressJson.baseUrl).toBe('http://localhost:4400');
  });

  it('should update `angular.json` file', async () => {
    const tree = await runSchematic(
      'cypress-project',
      { name: 'test-ui-lib' },
      appTree
    );
    const project = getProjectConfig(tree, 'test-ui-lib-e2e');

    expect(project.architect.e2e.options.devServerTarget).toEqual(
      'test-ui-lib:storybook'
    );
    expect(project.architect.e2e.options.headless).toBeUndefined();
    expect(project.architect.e2e.options.watch).toBeUndefined();
    expect(project.architect.e2e.configurations).toEqual({
      ci: { devServerTarget: `test-ui-lib:storybook:ci` },
    });
  });
});
