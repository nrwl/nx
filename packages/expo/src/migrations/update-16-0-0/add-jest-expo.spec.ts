import {
  addProjectConfiguration,
  readJson,
  Tree,
  updateJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import update from './add-jest-expo';

describe('Change expo jest preset', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    updateJson(tree, 'package.json', (packageJson) => {
      packageJson.devDependencies['random-preset'] = '*';
      return packageJson;
    });
    addProjectConfiguration(tree, 'products', {
      root: 'apps/products',
      sourceRoot: 'apps/products/src',
      targets: {
        start: {
          executor: '@nrwl/expo:start',
        },
        test: {
          executor: '@nrwl/jest:jest',
          options: {
            jestConfig: 'apps/products/jest.config.ts',
            passWithNoTests: true,
          },
        },
      },
    });
    tree.write(
      'apps/products/jest.config.ts',
      `module.exports = {
        preset: 'random-preset',
      };`
    );
  });

  it('should set jest-expo to jest preset', async () => {
    await update(tree);
    const jestConfig = tree.read('apps/products/jest.config.ts', 'utf-8');
    expect(jestConfig).toContain(`"preset": "jest-expo"`);
  });
});
