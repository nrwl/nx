import {
  readJson,
  readProjectConfiguration,
  Tree,
  updateJson,
  updateProjectConfiguration,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { jestInitGenerator } from '@nrwl/jest';
import { updateJestConfigExt } from './update-jest-config-ext';
import { libraryGenerator as workspaceLib } from '@nrwl/workspace';

describe('Jest Migration (v14.0.0)', () => {
  let tree: Tree;
  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace(2);
    jestInitGenerator(tree, { js: true, skipPackageJson: true });
    await workspaceLib(tree, { name: 'lib-one' });
    tree.rename('libs/lib-one/jest.config.ts', 'libs/lib-one/jest.config.js');
    updateProjectConfiguration(tree, 'lib-one', {
      ...readProjectConfiguration(tree, 'lib-one'),
      targets: {
        test: {
          executor: '@nrwl/jest:jest',
          options: {
            jestConfig: 'libs/lib-one/jest.config.js',
            passWithNoTests: true,
          },
          configurations: {
            production: {
              silent: true,
            },
          },
        },
      },
    });
  });

  it('should rename project jest.config.js to jest.config.ts', async () => {
    await updateJestConfigExt(tree);
    expect(tree.exists('libs/lib-one/jest.config.ts')).toBeTruthy();
    expect(tree.read('libs/lib-one/jest.config.ts', 'utf-8')).toMatchSnapshot();
  });

  it('should rename root jest files', async () => {
    await updateJestConfigExt(tree);
    expect(tree.exists('jest.config.ts')).toBeTruthy();
    expect(tree.exists('jest.preset.ts')).toBeTruthy();
  });

  it('should update jest.config.ts preset to use the jest.preset.ts', async () => {
    tree.rename('libs/lib-one/jest.config.js', 'libs/lib-one/jest.config.ts');
    const projectConfig = readProjectConfiguration(tree, 'lib-one');
    updateProjectConfiguration(tree, 'lib-one', {
      ...projectConfig,
      targets: {
        test: {
          ...projectConfig.targets.test,
          options: {
            jestConfig: 'libs/lib-one/jest.config.ts',
            passWithNoTests: true,
          },
        },
      },
    });
    expect(tree.exists('libs/lib-one/jest.config.ts')).toBeTruthy();
    await updateJestConfigExt(tree);
    expect(tree.exists('libs/lib-one/jest.config.ts')).toBeTruthy();
    expect(tree.read('libs/lib-one/jest.config.ts', 'utf-8')).toMatchSnapshot();
  });

  it('should only update js/ts files', async () => {
    tree.rename('libs/lib-one/jest.config.js', 'libs/lib-one/jest.config.ts');
    updateProjectConfiguration(tree, 'lib-one', {
      ...readProjectConfiguration(tree, 'lib-one'),
      targets: {
        test: {
          executor: '@nrwl/jest:jest',
          options: {
            jestConfig: 'libs/lib-one/jest.config.ts',
            passWithNoTests: true,
          },
        },
      },
    });

    await workspaceLib(tree, { name: 'lib-two' });
    tree.delete('libs/lib-two/jest.config.ts'); // lib generator creates a ts file
    tree.write('libs/lib-two/jest.config.json', '{}');
    updateProjectConfiguration(tree, 'lib-two', {
      ...readProjectConfiguration(tree, 'lib-two'),
      targets: {
        test: {
          executor: '@nrwl/jest:jest',
          options: {
            jestConfig: 'libs/lib-two/jest.config.json',
            passWithNoTests: true,
          },
        },
      },
    });
    await workspaceLib(tree, { name: 'lib-three' });

    expect(tree.exists('libs/lib-one/jest.config.ts')).toBeTruthy();
    await updateJestConfigExt(tree);
    expect(tree.exists('libs/lib-one/jest.config.ts')).toBeTruthy();
    expect(tree.exists('libs/lib-two/jest.config.ts')).toBeFalsy();
    expect(tree.exists('libs/lib-two/jest.config.json')).toBeTruthy();
    expect(tree.exists('libs/lib-three/jest.config.ts')).toBeTruthy();
  });

  it('should not throw error if file does not exit', async () => {
    tree.delete('libs/lib-one/jest.config.js');
    await updateJestConfigExt(tree);
    expect(tree.exists('libs/lib-one/jest.config.ts')).toBeFalsy();
    expect(tree.exists('libs/lib-one/jest.config.js')).toBeFalsy();
  });

  it('should update correct tsconfigs', async () => {
    updateJson(tree, 'libs/lib-one/tsconfig.lib.json', (json) => {
      json.exclude = ['**/*.spec.ts'];
      return json;
    });

    updateJson(tree, 'libs/lib-one/tsconfig.spec.json', (json) => {
      json.include = ['**/*.spec.ts'];
      return json;
    });

    await updateJestConfigExt(tree);

    const tsconfig = readJson(tree, 'libs/lib-one/tsconfig.json');
    const libTsConfig = readJson(tree, 'libs/lib-one/tsconfig.lib.json');
    const specTsConfig = readJson(tree, 'libs/lib-one/tsconfig.spec.json');

    expect(tsconfig.exclude).toBeFalsy();
    expect(libTsConfig.exclude).toEqual(['**/*.spec.ts', 'jest.config.ts']);
    expect(specTsConfig.exclude).toBeFalsy();
    expect(specTsConfig.include).toEqual(['**/*.spec.ts', 'jest.config.ts']);
  });

  it('should add exclude to root tsconfig with no references', async () => {
    tree.delete('libs/lib-one/tsconfig.spec.json');
    tree.delete('libs/lib-one/tsconfig.lib.json');

    updateJson(tree, 'libs/lib-one/tsconfig.json', (json) => {
      delete json.references;
      return json;
    });

    await updateJestConfigExt(tree);

    const tsconfig = readJson(tree, 'libs/lib-one/tsconfig.json');

    expect(tsconfig.exclude).toEqual(['jest.config.ts']);
    expect(tree.exists('libs/lib-one/tsconfig.spec.json')).toBeFalsy();
    expect(tree.exists('libs/lib-one/tsconfig.lib.json')).toBeFalsy();
  });
});
