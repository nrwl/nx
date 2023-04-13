import { Tree, readJson, updateJson, writeJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import replacePackage from './update-16-0-0-add-nx-packages';

describe('update-16-0-0-add-nx-packages', () => {
  let tree: Tree;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();

    updateJson(tree, 'package.json', (json) => {
      json.devDependencies['@nrwl/eslint-plugin-nx'] = '16.0.0';
      return json;
    });
  });

  it('should remove the dependency on @nrwl/eslint-plugin-nx', async () => {
    await replacePackage(tree);

    expect(
      readJson(tree, 'package.json').dependencies['@nrwl/eslint-plugin-nx']
    ).not.toBeDefined();
    expect(
      readJson(tree, 'package.json').devDependencies['@nrwl/eslint-plugin-nx']
    ).not.toBeDefined();
  });

  it('should add a dependency on @nx/eslint-plugin-nx', async () => {
    await replacePackage(tree);

    const packageJson = readJson(tree, 'package.json');
    const newDependencyVersion =
      packageJson.devDependencies['@nx/eslint-plugin-nx'] ??
      packageJson.dependencies['@nx/eslint-plugin-nx'];

    expect(newDependencyVersion).toBeDefined();
  });

  it('should replace the eslint plugin', async () => {
    writeJson(tree, '.eslintrc.json', {
      plugins: ['@nrwl/nx'],
      rules: {
        '@nrwl/nx/enforce-module-boundaries': ['error', {}],
      },
    });

    await replacePackage(tree);

    expect(readJson(tree, '.eslintrc.json')).toMatchInlineSnapshot(`
      {
        "plugins": [
          "@nx/nx",
        ],
        "rules": {
          "@nx/nx/enforce-module-boundaries": [
            "error",
            {},
          ],
        },
      }
    `);
  });
});
