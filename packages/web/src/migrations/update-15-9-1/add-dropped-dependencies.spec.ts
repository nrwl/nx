import {
  addProjectConfiguration,
  readJson,
  Tree,
  updateNxJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import addDroppedDependencies from './add-dropped-dependencies';

describe('addDroppedDependencies', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();

    addProjectConfiguration(tree, 'project-with-no-targets', {
      root: 'proj-with-no-targets',
    });
    addProjectConfiguration(tree, 'project-with-command', {
      root: 'proj-with-command',
      targets: {
        run: {
          command: 'echo hi',
        },
      },
    });
  });

  it('should add rollup', async () => {
    addProjectConfiguration(tree, 'rollup-project', {
      root: 'rollup-proj',
      targets: {
        build: {
          executor: '@nrwl/rollup:rollup',
          options: {},
        },
      },
    });

    await addDroppedDependencies(tree);

    expect(
      readJson(tree, 'package.json').devDependencies['@nrwl/rollup']
    ).toBeDefined();
    expect(
      readJson(tree, 'package.json').devDependencies['@nrwl/cypress']
    ).not.toBeDefined();
  });

  it('should add cypress', async () => {
    addProjectConfiguration(tree, 'cypress-project', {
      root: 'cypress-proj',
      targets: {
        build: {
          executor: '@nrwl/cypress:cypress',
          options: {},
        },
      },
    });

    await addDroppedDependencies(tree);

    expect(
      readJson(tree, 'package.json').devDependencies['@nrwl/cypress']
    ).toBeDefined();
    expect(
      readJson(tree, 'package.json').devDependencies['@nrwl/rollup']
    ).not.toBeDefined();
  });

  it('should add linter', async () => {
    addProjectConfiguration(tree, 'linter-project', {
      root: 'linter-proj',
      targets: {
        build: {
          executor: '@nrwl/linter:eslint',
          options: {},
        },
      },
    });

    await addDroppedDependencies(tree);

    expect(
      readJson(tree, 'package.json').devDependencies['@nrwl/linter']
    ).toBeDefined();
    expect(
      readJson(tree, 'package.json').devDependencies['@nrwl/cypress']
    ).not.toBeDefined();
  });

  it('should add a dependency if it is used in nx.json', async () => {
    updateNxJson(tree, {
      targetDefaults: {
        build: {
          executor: '@nrwl/linter:eslint',
          options: {},
        },
        test: {
          options: {},
        },
      },
    });

    await addDroppedDependencies(tree);

    expect(
      readJson(tree, 'package.json').devDependencies['@nrwl/linter']
    ).toBeDefined();
    expect(
      readJson(tree, 'package.json').devDependencies['@nrwl/cypress']
    ).not.toBeDefined();
  });
});
