import {
  addProjectConfiguration,
  logger,
  readProjectConfiguration,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { convertToApplicationExecutor } from './convert-to-application-executor';

describe('convert-to-application-executor generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    jest.spyOn(logger, 'info').mockImplementation(() => {});
    jest.spyOn(logger, 'warn').mockImplementation(() => {});
  });

  it(`should replace 'outputPath' to string if 'resourcesOutputPath' is set to 'media'`, async () => {
    addProjectConfiguration(tree, 'app1', {
      root: '/project/lib',
      projectType: 'application',
      targets: {
        build: {
          executor: '@angular-devkit/build-angular:browser',
          options: {
            outputPath: 'dist/app1',
            resourcesOutputPath: 'media',
          },
        },
      },
    });

    await convertToApplicationExecutor(tree, {});

    const project = readProjectConfiguration(tree, 'app1');
    const { outputPath, resourcesOutputPath } = project.targets.build.options;
    expect(outputPath).toStrictEqual({ base: 'dist/app1' });
    expect(resourcesOutputPath).toBeUndefined();
  });

  it(`should set 'outputPath.media' if 'resourcesOutputPath' is set and is not 'media'`, async () => {
    addProjectConfiguration(tree, 'app1', {
      root: '/project/lib',
      projectType: 'application',
      targets: {
        build: {
          executor: '@angular-devkit/build-angular:browser',
          options: {
            outputPath: 'dist/app1',
            resourcesOutputPath: 'resources',
          },
        },
      },
    });

    await convertToApplicationExecutor(tree, {});

    const project = readProjectConfiguration(tree, 'app1');
    const { outputPath, resourcesOutputPath } = project.targets.build.options;
    expect(outputPath).toStrictEqual({ base: 'dist/app1', media: 'resources' });
    expect(resourcesOutputPath).toBeUndefined();
  });

  it(`should remove 'browser' portion from 'outputPath'`, async () => {
    addProjectConfiguration(tree, 'app1', {
      root: '/project/lib',
      projectType: 'application',
      targets: {
        build: {
          executor: '@angular-devkit/build-angular:browser',
          options: {
            outputPath: 'dist/app1/browser',
            resourcesOutputPath: 'resources',
          },
        },
      },
    });

    await convertToApplicationExecutor(tree, {});

    const project = readProjectConfiguration(tree, 'app1');
    expect(project.targets.build.options.outputPath).toStrictEqual({
      base: 'dist/app1',
      media: 'resources',
    });
  });
});
