import { addProjectConfiguration, readJson, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import update from './add-missing-root-babel-config';

describe('Jest Migration (v13.4.4)', () => {
  let tree: Tree;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    tree.write(
      'package.json',
      JSON.stringify({
        name: 'test',
        version: '',
        description: '',
        devDependencies: {},
      })
    );
    tree.write(
      'libs/lib-one/jest.config.js',
      String.raw`module.exports = {
        transform: {
        '^.+\\\\.[tj]sx?$': 'babel-jest',
        }
  }`
    );

    addProjectConfiguration(tree, 'lib-one', {
      root: 'libs/lib-one',
      sourceRoot: 'libs/lib-one/src',
      projectType: 'library',
      targets: {
        build: {
          executor: '@nrwl/web:build',
        },
        test: {
          executor: '@nrwl/jest:jest',
          options: {
            jestConfig: 'libs/lib-one/jest.config.js',
            passWithNoTests: true,
          },
        },
      },
    });

    addProjectConfiguration(tree, 'lib-two', {
      root: 'libs/lib-two',
      sourceRoot: 'libs/lib-two/src',
      projectType: 'library',
      targets: {
        build: {
          executor: '@nrwl/web:build',
        },
        test: {
          executor: '@nrwl/jest:jest',
          options: {
            jestConfig: 'libs/lib-two/jest.config.js',
            passWithNoTests: true,
          },
        },
      },
    });
  });

  it('should create root babel.config.json and install @nrwl/web', async () => {
    await update(tree);
    expect(tree.exists('babel.config.json')).toBeTruthy();
    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.devDependencies['@nrwl/web']).toBeTruthy();
  });

  it('should not change anything if root babel.config.json is found', async () => {
    tree.write('babel.config.json', '{"babelrcRoots": ["*"]}');
    await update(tree);
    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.devDependencies['@nrwl/web']).toBeFalsy();
  });

  it('should update w/ Array value for babel-jest transformer', async () => {
    tree = createTreeWithEmptyWorkspace();

    tree.write(
      'libs/lib-three/jest.config.js',
      String.raw`module.exports = {
        transform: {
        '^.+\\\\.[tj]sx?$': ['babel-jest', {someOptionsThatDontMatter: false}],
        }
  }`
    );

    addProjectConfiguration(tree, 'lib-three', {
      root: 'libs/lib-three',
      sourceRoot: 'libs/lib-three/src',
      projectType: 'library',
      targets: {
        build: {
          executor: '@nrwl/web:build',
        },
        test: {
          executor: '@nrwl/jest:jest',
          options: {
            jestConfig: 'libs/lib-three/jest.config.js',
            passWithNoTests: true,
          },
        },
      },
    });

    await update(tree);
    expect(tree.exists('babel.config.json')).toBeTruthy();
    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.devDependencies['@nrwl/web']).toBeTruthy();
  });
});
