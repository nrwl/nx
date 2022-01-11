import { addProjectConfiguration, readJson, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import update from './update-react-native-typing-svg-13-5-0';

describe('Update svg typings in tsconfig for react native app', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'products', {
      root: 'apps/products',
      sourceRoot: 'apps/products/src',
      targets: {
        start: {
          executor: '@nrwl/react-native:start',
          options: {
            port: 8081,
          },
        },
        test: {
          executor: '@nrwl/jest:jest',
          options: {
            jestConfig: 'apps/products/jest.config.js',
            passWithNoTests: true,
          },
        },
      },
    });
  });

  it(`should add svg typing to tsconfig.json`, async () => {
    tree.write('apps/products/tsconfig.json', '{}');
    await update(tree);

    const tsconfig = readJson(tree, 'apps/products/tsconfig.json');
    expect(tsconfig.files).toEqual([
      '../../node_modules/@nrwl/react-native/typings/svg.d.ts',
    ]);
  });

  it(`should update to svg typing in tsconfig.json if image typing from react exists`, async () => {
    tree.write(
      'apps/products/tsconfig.json',
      `{
        "files": ["../../node_modules/@nrwl/react/typings/image.d.ts"]
      }`
    );
    await update(tree);

    const tsconfig = readJson(tree, 'apps/products/tsconfig.json');
    expect(tsconfig.files).toEqual([
      '../../node_modules/@nrwl/react-native/typings/svg.d.ts',
    ]);
  });

  it(`should update app's tsconfig.json and package.json if file does not exist`, async () => {
    await update(tree);

    expect(() => readJson(tree, 'apps/products/tsconfig.json')).toThrow();
  });
});
