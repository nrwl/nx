import { Tree } from '@angular-devkit/schematics';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { readJsonInTree, serializeJson } from '@nrwl/workspace';
import * as path from 'path';

describe('Add Cypress ESLint Plugin 9.4.0', () => {
  let tree: Tree;
  let schematicRunner: SchematicTestRunner;

  beforeEach(() => {
    tree = Tree.empty();
    tree.create(
      'package.json',
      serializeJson({
        devDependencies: { '@nrwl/cypress': '9.3.0' },
      })
    );

    tree.create(
      'workspace.json',
      serializeJson({
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
      serializeJson({
        extends: '../../.eslintrc',
      })
    );

    tree.create(
      'apps/project-two-e2e/.eslintrc',
      serializeJson({
        extends: ['../../.eslintrc'],
      })
    );

    schematicRunner = new SchematicTestRunner(
      '@nrwl/cypress',
      path.join(__dirname, '../../../migrations.json')
    );
  });

  it('should add eslint-plugin-cypress devDependency', async () => {
    const result = await schematicRunner
      .runSchematicAsync('add-cypress-eslint-plugin-9.4.0', {}, tree)
      .toPromise();

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
});
