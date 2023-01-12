import {
  addProjectConfiguration,
  getProjects,
  ProjectConfiguration,
  Tree,
} from '@nrwl/devkit';
import { createTreeWithEmptyV1Workspace } from '@nrwl/devkit/testing';
import refactorExecutorOptions from './refactor-executor-options';
import * as variousProjects from './test-configs/various-projects.json';

describe('update the executor options to match the new schema', () => {
  let tree: Tree;

  describe('for non-angular projects', () => {
    beforeEach(async () => {
      tree = createTreeWithEmptyV1Workspace();
      for (const [name, project] of Object.entries(variousProjects)) {
        addProjectConfiguration(tree, name, project as ProjectConfiguration);
      }
    });

    it(`should update the target options`, async () => {
      await refactorExecutorOptions(tree);

      const projects = getProjects(tree);
      expect(projects).toMatchSnapshot();
    });
  });
});
