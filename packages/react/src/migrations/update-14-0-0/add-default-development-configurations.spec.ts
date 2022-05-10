import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import {
  addProjectConfiguration,
  readProjectConfiguration,
} from '@nrwl/devkit';
import update from './add-default-development-configurations';

describe('React default development configuration', () => {
  it('should add development configuration if it does not exist', async () => {
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(
      tree,
      'example',
      {
        root: 'apps/example',
        projectType: 'application',
        targets: {
          build: {
            executor: '@nrwl/web:webpack',
            configurations: {},
          },
          serve: {
            executor: '@nrwl/web:dev-server',
            configurations: {},
          },
        },
      },
      true
    );

    await update(tree);

    const config = readProjectConfiguration(tree, 'example');

    expect(config.targets.build.defaultConfiguration).toEqual('production');
    expect(config.targets.build.configurations.development).toEqual({
      extractLicenses: false,
      optimization: false,
      sourceMap: true,
      vendorChunk: true,
    });

    expect(config.targets.serve.defaultConfiguration).toEqual('development');
    expect(config.targets.serve.configurations.development).toEqual({
      buildTarget: `example:build:development`,
    });
  });

  it('should work without targets', async () => {
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(
      tree,
      'example',
      {
        root: 'apps/example',
        projectType: 'application',
      },
      true
    );

    await update(tree);

    const config = readProjectConfiguration(tree, 'example');
    expect(config).toEqual({
      $schema: '../../node_modules/nx/schemas/project-schema.json',
      root: 'apps/example',
      projectType: 'application',
    });
  });
});
