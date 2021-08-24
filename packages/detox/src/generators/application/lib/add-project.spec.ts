import {
  addProjectConfiguration,
  readProjectConfiguration,
  Tree,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { Linter } from '@nrwl/linter';
import { addProject } from './add-project';

describe('Add Project', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'my-app', {
      root: 'my-app',
      targets: {
        serve: {
          executor: 'serve-executor',
          options: {},
          configurations: {
            production: {},
          },
        },
      },
    });
  });

  it('should update workspace.json', async () => {
    addProject(tree, {
      name: 'my-app-e2e',
      projectName: 'my-app-e2e',
      projectRoot: 'apps/my-app-e2e',
      project: 'my-app',
      appFileName: 'my-app',
      appClassName: 'MyApp',
      linter: Linter.EsLint,
    });
    const project = readProjectConfiguration(tree, 'my-app-e2e');

    expect(project.root).toEqual('apps/my-app-e2e');
    expect(project.sourceRoot).toEqual('apps/my-app-e2e/src');
  });

  it('should update nx.json', async () => {
    addProject(tree, {
      name: 'my-app-e2e',
      projectName: 'my-app-e2e',
      projectRoot: 'apps/my-app-e2e',
      project: 'my-app',
      appFileName: 'my-app',
      appClassName: 'MyApp',
      linter: Linter.EsLint,
    });

    const project = readProjectConfiguration(tree, 'my-app-e2e');
    expect(project.tags).toEqual([]);
    expect(project.implicitDependencies).toEqual(['my-app']);
  });
});
