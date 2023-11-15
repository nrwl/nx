import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';
import {
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';

import update from './add-eslint-plugin';

describe('add-eslint-plugin migration', () => {
  let tree: Tree;
  let tempFs: TempFs;

  beforeEach(async () => {
    tempFs = new TempFs('test');
    tree = createTreeWithEmptyWorkspace();
    tree.root = tempFs.tempDir;
    await tempFs.createFiles({
      'apps/my-app/.eslintrc.json': '{}',
      'apps/my-app/project.json': '{ "name": "my-app" }',
    });
  });

  afterEach(() => {
    jest.resetModules();
    tempFs.cleanup();
  });

  it('should remove the lint target when there are no other options', async () => {
    updateProjectConfiguration(tree, 'my-app', {
      root: 'apps/my-app',
      targets: {
        lint: {
          executor: '@nx/eslint:lint',
          options: {
            lintFilePatterns: ['apps/my-app'],
          }
        },
      },
    });

    await update(tree);

    expect(readProjectConfiguration(tree, 'my-app').targets.lint).toBeUndefined();
  });

  it('should not remove the lint target when it uses different executor', async () => {
    const lintTarget = {
      executor: '@bun/linter:lint',
      options: {
        lintFilePatterns: ['apps/my-app'],
      }
    };
    updateProjectConfiguration(tree, 'my-app', {
      root: 'apps/my-app',
      targets: {
        lint: lintTarget,
      },
    });

    await update(tree);

    expect(readProjectConfiguration(tree, 'my-app').targets.lint).toEqual(lintTarget);
  });

  it('should leave other options in', async () => {
    updateProjectConfiguration(tree, 'my-app', {
      root: 'apps/my-app',
      targets: {
        lint: {
          executor: '@nx/eslint:lint',
          options: {
            lintFilePatterns: ['apps/my-app'],
            format: 'stylish',
            eslintConfig: '.eslintrc.js'
          }
        },
      },
    });

    await update(tree);

    expect(readProjectConfiguration(tree, 'my-app').targets.lint).toEqual({
      options: {
        format: 'stylish',
        eslintConfig: '.eslintrc.js'
      }
    });
  });
});
