import {
  Tree,
  writeJson,
  readWorkspaceConfiguration,
  addProjectConfiguration,
  getProjects,
  readJson,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { updateTscExecutorLocation } from './update-tsc-executor-location';

describe('add `defaultBase` in nx.json', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace(2);
  });

  it('should update @nrwl/workspace:tsc -> @nrwl/js:tsc', async () => {
    addProjectConfiguration(tree, 'tsc-project', {
      root: 'projects/tsc-project',
      targets: {
        build: {
          executor: '@nrwl/workspace:tsc',
        },
        test: {
          executor: '@nrwl/jest:jest',
        },
      },
    });
    addProjectConfiguration(tree, 'other-project', {
      root: 'projects/other-project',
      targets: {
        build: {
          executor: '@nrwl/react:build',
        },
        test: {
          executor: '@nrwl/jest:jest',
        },
      },
    });
    await updateTscExecutorLocation(tree);
    const projects = Object.fromEntries(getProjects(tree).entries());
    expect(projects).toEqual({
      'tsc-project': {
        root: 'projects/tsc-project',
        targets: {
          build: {
            executor: '@nrwl/js:tsc',
          },
          test: {
            executor: '@nrwl/jest:jest',
          },
        },
      },
      'other-project': {
        root: 'projects/other-project',
        targets: {
          build: {
            executor: '@nrwl/react:build',
          },
          test: {
            executor: '@nrwl/jest:jest',
          },
        },
      },
    });
  });

  it('should add @nrwl/js dependency', async () => {
    addProjectConfiguration(tree, 'tsc-project', {
      root: 'projects/tsc-project',
      targets: {
        build: {
          executor: '@nrwl/workspace:tsc',
        },
      },
    });
    await updateTscExecutorLocation(tree);
    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.devDependencies).toMatchObject({
      '@nrwl/js': expect.anything(),
    });
  });
});
