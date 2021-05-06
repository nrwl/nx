import { Tree } from '@angular-devkit/schematics';
import { readJsonInTree } from '@nrwl/workspace/src/utils/ast-utils';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import * as path from 'path';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { serializeJson } from '@nrwl/workspace';
import { readFileSync } from 'fs';

describe('Update 9.0.1', () => {
  let initialTree: Tree;
  let schematicRunner: SchematicTestRunner;

  beforeEach(async () => {
    initialTree = createEmptyWorkspace(Tree.empty());

    schematicRunner = new SchematicTestRunner(
      '@nrwl/jest',
      path.join(__dirname, '../../../migrations.json')
    );
  });
  it('should remove passWithNoTests in jest.config.js', async () => {
    initialTree.create(
      'jest.config.js',
      readFileSync(
        path.join(__dirname, './test-files/jest.config.js')
      ).toString()
    );
    const initialJestConfigFile = initialTree.read('jest.config.js').toString();
    expect(initialJestConfigFile).toContain('passWithNoTests: true');

    const result = await schematicRunner
      .runSchematicAsync('update-9.0.1', {}, initialTree)
      .toPromise();

    const updatedJestConfigFile = result.readContent('jest.config.js');
    expect(updatedJestConfigFile).not.toContain('passWithNoTests: true');

    //check if the file is still valid
    expect(updatedJestConfigFile.match(/,/g) || []).toHaveLength(8);
    expect(updatedJestConfigFile).toContain('}');
    expect(updatedJestConfigFile).toContain('{');
  });

  it('should add passWithNoTests to workspace.json where it does not exist', async () => {
    initialTree.overwrite(
      'workspace.json',
      serializeJson({
        version: 1,
        projects: {
          'angular-one': {
            architect: {
              test: {
                builder: '@nrwl/jest:jest',
                options: {
                  jestConfig: 'apps/angular-one/jest.config.js',
                },
              },
            },
          },
          'angular-two': {
            architect: {
              test: {
                builder: '@nrwl/jest:jest',
                options: {
                  passWithNoTests: false,
                },
              },
            },
          },
          other1: {
            architect: {
              'other-architect': {
                builder: 'other',
                options: {
                  foo: 'bar',
                },
              },
              test: {
                builder: '@nrwl/jest:jest',
                options: {},
              },
            },
          },
        },
      })
    );

    await schematicRunner
      .runSchematicAsync('update-9.0.1', {}, initialTree)
      .toPromise();

    const workspaceJson = readJsonInTree(initialTree, 'workspace.json');
    expect(
      workspaceJson.projects['angular-one'].architect.test.options
        .passWithNoTests
    ).toBeTruthy();
    expect(
      workspaceJson.projects['angular-two'].architect.test.options
        .passWithNoTests
    ).toBeFalsy();
    expect(
      workspaceJson.projects.other1.architect['other-architect'].options
        .passWithNoTests
    ).toBeUndefined();
    expect(
      workspaceJson.projects.other1.architect.test.options.passWithNoTests
    ).toBeTruthy();
  });

  it('should add passWithNoTests to angular.json where it does not exist', async () => {
    initialTree.create(
      'angular.json',
      JSON.stringify({
        version: 1,
        projects: {
          frontend: {
            architect: {
              jest1: {
                builder: '@nrwl/jest:jest',
                options: {
                  foo: 'bar',
                },
              },
              jest2: {
                builder: '@nrwl/jest:jest',
                options: {
                  foo: 'bar',
                  passWithNoTests: false,
                },
              },
              other1: {
                options: {
                  foo: 'bar',
                },
              },
            },
          },
        },
      })
    );

    await schematicRunner
      .runSchematicAsync('update-9.0.1', {}, initialTree)
      .toPromise();

    const angularJson = readJsonInTree(initialTree, 'angular.json');

    expect(
      angularJson.projects.frontend.architect.jest1.options.passWithNoTests
    ).toBeTruthy();
    expect(
      angularJson.projects.frontend.architect.jest2.options.passWithNoTests
    ).toBeFalsy();
    expect(
      angularJson.projects.frontend.architect.other1.options.passWithNoTests
    ).toBeUndefined();
  });
});
