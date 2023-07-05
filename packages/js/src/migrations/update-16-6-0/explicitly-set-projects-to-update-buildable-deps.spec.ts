import {
  ProjectConfiguration,
  Tree,
  addProjectConfiguration,
  readProjectConfiguration,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './explicitly-set-projects-to-update-buildable-deps';

describe('explicitly-set-projects-to-update-buildable-deps migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it.each(['@nx/js:swc', '@nrwl/js:swc', '@nx/js:tsc', '@nrwl/js:tsc'])(
    'should set updateBuildableProjectDepsInPackageJson option to "true" when not specified in target using "%s"',
    async (executor) => {
      addProjectConfiguration(tree, 'lib1', {
        root: 'libs/lib1',
        projectType: 'library',
        targets: { build: { executor, options: {} } },
      });

      await migration(tree);

      const project = readProjectConfiguration(tree, 'lib1');
      expect(
        project.targets.build.options.updateBuildableProjectDepsInPackageJson
      ).toBe(true);
    }
  );

  it.each(['@nx/js:swc', '@nrwl/js:swc', '@nx/js:tsc', '@nrwl/js:tsc'])(
    'should not overwrite updateBuildableProjectDepsInPackageJson option when it is specified in target using "%s"',
    async (executor) => {
      addProjectConfiguration(tree, 'lib1', {
        root: 'libs/lib1',
        projectType: 'library',
        targets: {
          build: {
            executor,
            options: { updateBuildableProjectDepsInPackageJson: false },
          },
        },
      });

      await migration(tree);

      const project = readProjectConfiguration(tree, 'lib1');
      expect(
        project.targets.build.options.updateBuildableProjectDepsInPackageJson
      ).toBe(false);
    }
  );

  it('should not update targets using other executors', async () => {
    const originalProjectConfig: ProjectConfiguration = {
      root: 'libs/lib1',
      projectType: 'library',
      targets: {
        build: {
          executor: 'some-executor',
          options: {},
        },
      },
    };
    addProjectConfiguration(tree, 'lib1', originalProjectConfig);

    await migration(tree);

    const project = readProjectConfiguration(tree, 'lib1');
    expect(project.targets).toStrictEqual(originalProjectConfig.targets);
  });
});
