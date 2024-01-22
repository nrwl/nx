import {
  ProjectConfiguration,
  ProjectGraph,
  Tree,
  addProjectConfiguration,
  readProjectConfiguration,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './explicitly-set-projects-to-update-buildable-deps';

let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  createProjectGraphAsync: () => Promise.resolve(projectGraph),
  formatFiles: jest.fn(),
}));

describe('explicitly-set-projects-to-update-buildable-deps migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    projectGraph = { dependencies: {}, nodes: {} };
  });

  it.each([
    '@nx/angular:ng-packagr-lite',
    '@nrwl/angular:ng-packagr-lite',
    '@nx/angular:package',
    '@nrwl/angular:package',
  ])(
    'should set updateBuildableProjectDepsInPackageJson option to "true" when not specified in target using "%s"',
    async (executor) => {
      addProject(tree, 'lib1', {
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

  it.each([
    '@nx/angular:ng-packagr-lite',
    '@nrwl/angular:ng-packagr-lite',
    '@nx/angular:package',
    '@nrwl/angular:package',
  ])(
    'should set updateBuildableProjectDepsInPackageJson option to "true" when target has no options object defined using "%s"',
    async (executor) => {
      addProject(tree, 'lib1', {
        root: 'libs/lib1',
        projectType: 'library',
        targets: { build: { executor } },
      });

      await migration(tree);

      const project = readProjectConfiguration(tree, 'lib1');
      expect(
        project.targets.build.options.updateBuildableProjectDepsInPackageJson
      ).toBe(true);
    }
  );

  it.each([
    '@nx/angular:ng-packagr-lite',
    '@nrwl/angular:ng-packagr-lite',
    '@nx/angular:package',
    '@nrwl/angular:package',
  ])(
    'should not overwrite updateBuildableProjectDepsInPackageJson option when it is specified in target using "%s"',
    async (executor) => {
      addProject(tree, 'lib1', {
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
    addProject(tree, 'lib1', originalProjectConfig);

    await migration(tree);

    const project = readProjectConfiguration(tree, 'lib1');
    expect(project.targets).toStrictEqual(originalProjectConfig.targets);
  });
});

function addProject(
  tree: Tree,
  projectName: string,
  config: ProjectConfiguration
): void {
  projectGraph = {
    dependencies: {},
    nodes: {
      [projectName]: {
        data: config,
        name: projectName,
        type: config.projectType === 'application' ? 'app' : 'lib',
      },
    },
  };
  addProjectConfiguration(tree, projectName, config);
}
