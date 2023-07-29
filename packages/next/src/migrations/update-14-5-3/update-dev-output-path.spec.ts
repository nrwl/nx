import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { addProjectConfiguration, readProjectConfiguration } from '@nx/devkit';
import update from './update-dev-output-path';

describe('React default development configuration', () => {
  it('should add output path if it does not alreayd exist', async () => {
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(
      tree,
      'example',
      {
        root: 'apps/example',
        sourceRoot: 'apps/example',
        projectType: 'application',
        targets: {
          build: {
            executor: '@nrwl/next:build',
            configurations: {
              development: {},
            },
          },
        },
      },
      true
    );

    await update(tree);

    const config = readProjectConfiguration(tree, 'example');

    expect(config.targets.build.configurations.development.outputPath).toEqual(
      'apps/example'
    );
  });

  it('should add output path is default generated pat', async () => {
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(
      tree,
      'example',
      {
        root: 'apps/example',
        sourceRoot: 'apps/example',
        projectType: 'application',
        targets: {
          build: {
            executor: '@nrwl/next:build',
            configurations: {
              development: { outputPath: 'tmp/apps/example' },
            },
          },
        },
      },
      true
    );

    await update(tree);

    const config = readProjectConfiguration(tree, 'example');

    expect(config.targets.build.configurations.development.outputPath).toEqual(
      'apps/example'
    );
  });

  it('should skip update if outputPath already exists for development and does not match expected path', async () => {
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(
      tree,
      'example',
      {
        root: 'apps/example',
        sourceRoot: 'apps/example',
        projectType: 'application',
        targets: {
          build: {
            executor: '@nrwl/next:build',
            configurations: {
              development: { outputPath: '.tmp/custom' },
            },
          },
        },
      },
      true
    );

    await update(tree);

    const config = readProjectConfiguration(tree, 'example');

    expect(config.targets.build.configurations.development.outputPath).toEqual(
      '.tmp/custom'
    );
  });
});
