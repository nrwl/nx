import {
  addProjectConfiguration,
  ProjectConfiguration,
  readProjectConfiguration,
  Tree,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import migration from './set-build-libs-from-source';

describe('set-build-libs-from-source migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace(2);
  });

  it('should not error when project does not have targets', async () => {
    addProjectConfiguration(tree, 'app1', { root: 'apps/app1' });

    await expect(migration(tree)).resolves.not.toThrow();
  });

  it('should not update when not using the @nrwl/angular:webpack-browser executor', async () => {
    const project: ProjectConfiguration = {
      root: 'apps/app1',
      targets: { build: { executor: '@nrwl/angular:package' } },
    };
    addProjectConfiguration(tree, 'app1', project);

    // add $schema to projectConfig manually
    project['$schema'] = '../../node_modules/nx/schemas/project-schema.json';

    await migration(tree);

    const resultingProject = readProjectConfiguration(tree, 'app1');
    expect(project).toStrictEqual(resultingProject);
  });

  it('should set buildLibsFromSource to false', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: { build: { executor: '@nrwl/angular:webpack-browser' } },
    });

    await migration(tree);

    const project = readProjectConfiguration(tree, 'app1');
    expect(project.targets.build.options).toStrictEqual({
      buildLibsFromSource: false,
    });
  });

  it('should support any target name using @nrwl/angular:webpack-browser', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: { 'build-base': { executor: '@nrwl/angular:webpack-browser' } },
    });

    await migration(tree);

    const project = readProjectConfiguration(tree, 'app1');
    expect(project.targets['build-base'].options).toStrictEqual({
      buildLibsFromSource: false,
    });
  });
});
