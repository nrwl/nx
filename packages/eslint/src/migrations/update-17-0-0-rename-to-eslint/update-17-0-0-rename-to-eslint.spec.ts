import {
  Tree,
  addProjectConfiguration,
  readJson,
  updateJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import replacePackage from './update-17-0-0-rename-to-eslint';

describe('update-17-0-0-rename-to-eslint', () => {
  let tree: Tree;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();

    updateJson(tree, 'package.json', (json) => {
      json.devDependencies['@nx/linter'] = '17.0.0';
      return json;
    });

    updateJson(tree, 'nx.json', (json) => {
      json.targetDefaults = {
        lint: {
          executor: '@nx/linter:eslint',
        },
      };
      return json;
    });
  });

  it('should remove the dependency on @nx/linter', async () => {
    await replacePackage(tree);

    expect(
      readJson(tree, 'package.json').dependencies['@nx/linter']
    ).not.toBeDefined();
    expect(
      readJson(tree, 'package.json').devDependencies['@nx/linter']
    ).not.toBeDefined();
  });

  it('should add a dependency on @nx/eslint', async () => {
    await replacePackage(tree);

    const packageJson = readJson(tree, 'package.json');
    const newDependencyVersion =
      packageJson.devDependencies['@nx/eslint'] ??
      packageJson.dependencies['@nx/eslint'];

    expect(newDependencyVersion).toBeDefined();
  });

  it('should update the targetDefaults', async () => {
    await replacePackage(tree);

    const nxJson = readJson(tree, 'nx.json');
    expect(nxJson.targetDefaults.lint.executor).toEqual('@nx/eslint:lint');
  });

  it('should update the target executor', async () => {
    addProjectConfiguration(tree, 'test-lib', {
      root: 'libs/test-lib',
      projectType: 'library',
      targets: {
        lint: {
          executor: '@nx/linter:eslint',
        },
      },
    });

    await replacePackage(tree);

    const projJson = readJson(tree, 'libs/test-lib/project.json');
    expect(projJson.targets.lint.executor).toEqual('@nx/eslint:lint');
  });
});
