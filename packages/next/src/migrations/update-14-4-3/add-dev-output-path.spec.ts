import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { addProjectConfiguration, readProjectConfiguration } from '@nx/devkit';
import update from './add-dev-output-path';

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
      'tmp/apps/example'
    );
  });

  it('should skip update if outputPath already exists for development', async () => {
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
              development: { outputPath: '/tmp/some/custom/path' },
            },
          },
        },
      },
      true
    );

    await update(tree);

    const config = readProjectConfiguration(tree, 'example');

    expect(config.targets.build.configurations.development.outputPath).toEqual(
      '/tmp/some/custom/path'
    );
  });
});
