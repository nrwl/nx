import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree, readJson, updateJson } from '@nx/devkit';

import generator from './generator';
import { SetupVerdaccioGeneratorSchema } from './schema';
import { PackageJson } from 'nx/src/utils/package-json';

describe('setup-verdaccio generator', () => {
  let tree: Tree;
  const options: SetupVerdaccioGeneratorSchema = { skipFormat: false };

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should create project.json if it does not exist', async () => {
    await generator(tree, options);
    const config = readJson(tree, 'project.json');
    expect(config).toEqual({
      name: 'test-name',
      $schema: 'node_modules/nx/schemas/project-schema.json',
      targets: {
        'local-registry': {
          executor: '@nx/js:verdaccio',
          options: {
            port: 4873,
            config: '.verdaccio/config.yml',
            storage: 'tmp/local-registry/storage',
          },
        },
      },
    });
    const packageJson = readJson<PackageJson>(tree, 'package.json');
    expect(packageJson.nx).toEqual({
      includedScripts: [],
    });
  });

  it('should not override existing root project settings from package.json', async () => {
    updateJson(tree, 'package.json', (json) => {
      json.nx = {
        includedScripts: ['test'],
        targets: {
          build: {
            outputs: ['dist'],
          },
        },
      };
      return json;
    });
    await generator(tree, options);
    const config = readJson(tree, 'project.json');
    expect(config).toEqual({
      name: 'test-name',
      $schema: 'node_modules/nx/schemas/project-schema.json',
      targets: {
        'local-registry': {
          executor: '@nx/js:verdaccio',
          options: {
            port: 4873,
            config: '.verdaccio/config.yml',
            storage: 'tmp/local-registry/storage',
          },
        },
      },
    });
    const packageJson = readJson<PackageJson>(tree, 'package.json');
    expect(packageJson.nx).toEqual({
      includedScripts: ['test'],
      targets: {
        build: {
          outputs: ['dist'],
        },
      },
    });
  });

  it('should add local-registry target to project.json', async () => {
    tree.write('project.json', JSON.stringify({}));
    await generator(tree, options);
    const config = readJson(tree, 'project.json');
    expect(config).toEqual({
      targets: {
        'local-registry': {
          executor: '@nx/js:verdaccio',
          options: {
            port: 4873,
            config: '.verdaccio/config.yml',
            storage: 'tmp/local-registry/storage',
          },
        },
      },
    });
  });

  it('should not override existing local-registry target to project.json if target already exists', async () => {
    tree.write(
      'project.json',
      JSON.stringify({
        targets: {
          'local-registry': {},
        },
      })
    );
    await generator(tree, options);
    const config = readJson(tree, 'project.json');
    expect(config).toEqual({
      targets: {
        'local-registry': {},
      },
    });
  });

  it('should be able to run setup verdaccio multiple times', async () => {
    await generator(tree, options);
    tree.write(
      'project.json',
      JSON.stringify({
        targets: {
          'local-registry': {},
        },
      })
    );
    await generator(tree, options);
    const config = readJson(tree, 'project.json');
    expect(config).toEqual({
      targets: {
        'local-registry': {},
      },
    });
  });

  it('should install verdaccio to devDependencies', async () => {
    await generator(tree, options);
    const packageJson: PackageJson = readJson(tree, 'package.json');
    expect(packageJson.devDependencies).toEqual({
      verdaccio: '^5.0.4',
    });
  });
});
