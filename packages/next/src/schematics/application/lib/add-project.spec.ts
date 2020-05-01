import { normalize } from '@angular-devkit/core';
import { Tree } from '@angular-devkit/schematics';
import { UnitTestTree } from '@angular-devkit/schematics/testing';
import { Linter, readJsonInTree } from '@nrwl/workspace';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { callRule } from '../../../utils/testing';
import { addProject } from './add-project';
import { NormalizedSchema } from './normalize-options';

describe('addProject Rule', () => {
  let tree: Tree;
  let schema: NormalizedSchema;

  beforeEach(async () => {
    tree = createEmptyWorkspace(Tree.empty());

    schema = {
      name: 'todos',
      skipFormat: false,
      unitTestRunner: 'jest',
      e2eTestRunner: 'cypress',
      linter: Linter.EsLint,
      projectName: 'todos',
      appProjectRoot: normalize('/apps/todos'),
      e2eProjectName: 'todos-e2e',
      e2eProjectRoot: normalize('/apps/todos-e2e'),
      parsedTags: [],
      fileName: 'index',
      styledModule: null,
    };
  });

  it('should add the build configuration correctly', async () => {
    tree = (await callRule(addProject(schema), tree)) as UnitTestTree;

    const workspaceJson = readJsonInTree(tree, '/workspace.json');

    const project = workspaceJson.projects[schema.name];
    expect(project.architect.build).toEqual({
      builder: '@nrwl/next:build',
      configurations: {
        production: {},
      },
      options: {
        outputPath: 'dist/apps/todos',
        root: '/apps/todos',
      },
    });
  });
});
