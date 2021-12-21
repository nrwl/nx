import { Tree } from '@angular-devkit/schematics';
import { readJsonInTree, updateJsonInTree } from '@nrwl/workspace';
import { callRule, runMigration } from '../../utils/testing';

describe('Add Cypress ESLint Plugin 9.4.0', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = Tree.empty();
    tree.create(
      'package.json',
      JSON.stringify({
        devDependencies: { '@nrwl/cypress': '9.3.0', eslint: '6.8.0' },
      })
    );

    tree.create(
      'workspace.json',
      JSON.stringify({
        projects: {
          'project-one-e2e': {
            root: 'apps/project-one-e2e',
            architect: {
              e2e: {
                builder: '@nrwl/cypress:cypress',
              },
            },
          },
          'project-two-e2e': {
            root: 'apps/project-two-e2e',
            architect: {
              e2e: {
                builder: '@nrwl/cypress:cypress',
              },
            },
          },
        },
      })
    );

    tree.create(
      'apps/project-one-e2e/.eslintrc',
      JSON.stringify({
        extends: '../../.eslintrc',
      })
    );

    tree.create(
      'apps/project-two-e2e/.eslintrc',
      JSON.stringify({
        extends: ['../../.eslintrc'],
      })
    );
  });

  it('should add eslint-plugin-cypress devDependency', async () => {
    const result = await runMigration(
      'add-cypress-eslint-plugin-9.4.0',
      {},
      tree
    );

    const { devDependencies } = readJsonInTree(result, '/package.json');
    const projectOneEslintrcJson = readJsonInTree(
      result,
      'apps/project-one-e2e/.eslintrc'
    );
    const projectTwoEslintrcJson = readJsonInTree(
      result,
      'apps/project-two-e2e/.eslintrc'
    );

    expect(devDependencies['eslint-plugin-cypress']).toEqual('^2.10.3');
    expect(projectOneEslintrcJson.extends).toContain(
      'plugin:cypress/recommended'
    );
    expect(projectTwoEslintrcJson.extends).toContain(
      'plugin:cypress/recommended'
    );
  });

  it('should not add eslint-plugin-cypress if eslint is not used', async () => {
    tree = await callRule(
      updateJsonInTree('package.json', (json) => {
        delete json.devDependencies.eslint;
        return json;
      }),
      tree
    );

    const result = await runMigration(
      'add-cypress-eslint-plugin-9.4.0',
      {},
      tree
    );
    const { devDependencies } = readJsonInTree(result, '/package.json');
    expect(devDependencies['eslint-plugin-cypress']).not.toBeDefined();
  });
});
