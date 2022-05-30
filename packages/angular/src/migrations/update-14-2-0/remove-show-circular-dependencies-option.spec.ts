import {
  addProjectConfiguration,
  readProjectConfiguration,
  Tree,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import removeShowCircularDependencies from './remove-show-circular-dependencies-option';

describe('remove-show-circular-dependencies-option migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace(2);
  });

  it.each([
    '@angular-devkit/build-angular:browser',
    '@angular-devkit/build-angular:server',
    '@nrwl/angular:webpack-browser',
  ])(
    'should remove "showCircularDependencies" option from target using the "%s" executor',
    async (executor) => {
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        sourceRoot: 'apps/app1/src',
        projectType: 'application',
        targets: {
          build: {
            executor,
            options: { extractCss: false, showCircularDependencies: true },
            configurations: {
              one: { showCircularDependencies: false, aot: true },
              two: { showCircularDependencies: false, aot: true },
            },
          },
        },
      });

      await removeShowCircularDependencies(tree);

      const project = readProjectConfiguration(tree, 'app1');
      expect(
        project.targets.build.options.showCircularDependencies
      ).toBeUndefined();
      expect(project.targets.build.configurations).toBeDefined();
      expect(
        project.targets.build.configurations.one.showCircularDependencies
      ).toBeUndefined();
      expect(
        project.targets.build.configurations.two.showCircularDependencies
      ).toBeUndefined();
    }
  );

  it('should not remove "showCircularDependencies" from target not using the relevant executors', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      sourceRoot: 'apps/app1/src',
      projectType: 'application',
      targets: {
        build: {
          executor: '@org/awesome-plugin:executor',
          options: { extractCss: false, showCircularDependencies: true },
          configurations: {
            one: { showCircularDependencies: false, aot: true },
            two: { showCircularDependencies: false, aot: true },
          },
        },
      },
    });

    await removeShowCircularDependencies(tree);

    const project = readProjectConfiguration(tree, 'app1');
    expect(
      project.targets.build.options.showCircularDependencies
    ).toBeDefined();
    expect(project.targets.build.configurations).toBeDefined();
    expect(
      project.targets.build.configurations.one.showCircularDependencies
    ).toBeDefined();
    expect(
      project.targets.build.configurations.two.showCircularDependencies
    ).toBeDefined();
  });
});
