import {
  ProjectConfiguration,
  readJson,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { libraryGenerator } from '@nrwl/workspace';
import { defaultExclude } from '../../utils/swc/add-swc-config';
import update from './update-swcrc';

describe('Migration: adjust .swcrc', () => {
  let tree: Tree;
  let projectConfiguration: ProjectConfiguration;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    libraryGenerator(tree, {
      name: 'swc',
      buildable: true,
      linter: 'none',
      unitTestRunner: 'none',
    });
    projectConfiguration = readProjectConfiguration(tree, 'swc');
    updateProjectConfiguration(tree, 'swc', {
      ...projectConfiguration,
      targets: {
        ...projectConfiguration.targets,
        build: {
          ...projectConfiguration.targets['build'],
          executor: '@nrwl/js:swc',
        },
      },
    });
    // re-read the project configuration
    projectConfiguration = readProjectConfiguration(tree, 'swc');
  });

  it('should rename .swcrc to .lib.swcrc', async () => {
    addSwcrc();
    await update(tree);

    expect(tree.exists('libs/swc/.swcrc')).toEqual(false);
    expect(tree.exists('libs/swc/.lib.swcrc')).toEqual(true);
  });

  it('should assign default exclude if swcrc does not already have exclude', async () => {
    addSwcrc();
    await update(tree);

    expect(readJson(tree, 'libs/swc/.lib.swcrc')['exclude']).toEqual(
      defaultExclude
    );
  });

  it('should use swcExclude (deprecated) to assign to exclude', async () => {
    const swcExclude = ['./src/**/.*.spec.ts$'];
    updateProjectConfiguration(tree, 'swc', {
      ...projectConfiguration,
      targets: {
        ...projectConfiguration.targets,
        build: {
          ...projectConfiguration.targets['build'],
          options: {
            ...projectConfiguration.targets['build']['options'],
            swcExclude,
          },
        },
      },
    });

    addSwcrc();
    await update(tree);

    expect(readJson(tree, 'libs/swc/.lib.swcrc')['exclude']).toEqual(
      swcExclude
    );
  });

  it('should skip updating "exclude" if swcrc already has "exclude" field', async () => {
    addSwcrc(true);
    await update(tree);
    expect(readJson(tree, 'libs/swc/.lib.swcrc')['exclude']).toEqual([
      './**/.*.spec.ts$',
    ]);
  });

  function addSwcrc(withExclude = false) {
    tree.write(
      'libs/swc/.swcrc',
      JSON.stringify(withExclude ? { exclude: ['./**/.*.spec.ts$'] } : {})
    );
  }
});
