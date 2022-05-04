import {
  readJson,
  readProjectConfiguration,
  Tree,
  updateJson,
  updateProjectConfiguration,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { jestInitGenerator } from '@nrwl/jest';
import { libraryGenerator as workspaceLib } from '@nrwl/workspace';
import { updateJestConfigExt } from './update-jest-config-ext';

const setupDefaults = {
  js: true,
  skipPackageJson: true,
  libName: 'lib-one',
  setParserOptionsProject: false,
};

async function libSetUp(tree: Tree, options = setupDefaults) {
  jestInitGenerator(tree, {
    js: options.js,
    skipPackageJson: options.skipPackageJson,
  });
  await workspaceLib(tree, {
    name: options.libName,
    setParserOptionsProject: options.setParserOptionsProject,
  });
  tree.rename(
    `libs/${options.libName}/jest.config.ts`,
    `libs/${options.libName}/jest.config.js`
  );
  const config = tree.read(`libs/${options.libName}/jest.config.js`, 'utf-8');
  tree.write(
    `libs/${options.libName}/jest.config.js`,
    config
      .replace(/\/\* eslint-disable \*\//g, '')
      .replace(/export default/g, 'module.exports =')
  );
  updateProjectConfiguration(tree, options.libName, {
    ...readProjectConfiguration(tree, options.libName),
    targets: {
      test: {
        executor: '@nrwl/jest:jest',
        options: {
          jestConfig: `libs/${options.libName}/jest.config.js`,
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
}

describe('Jest Migration (v14.0.0)', () => {
  let tree: Tree;
  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace(2);
  });

  it('should rename project jest.config.js to jest.config.ts', async () => {
    await libSetUp(tree);

    await updateJestConfigExt(tree);
    expect(tree.exists('libs/lib-one/jest.config.ts')).toBeTruthy();
    expect(tree.read('libs/lib-one/jest.config.ts', 'utf-8')).toMatchSnapshot();
  });

  it('should rename root jest.config.js', async () => {
    await libSetUp(tree);

    await updateJestConfigExt(tree);
    expect(tree.exists('jest.config.ts')).toBeTruthy();
    expect(tree.exists('jest.preset.js')).toBeTruthy();
  });

  it('should NOT update jest.config.ts preset', async () => {
    await libSetUp(tree);

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
    await libSetUp(tree);

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

    await libSetUp(tree, { ...setupDefaults, libName: 'lib-two' });
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

    await libSetUp(tree, { ...setupDefaults, libName: 'lib-three' });
    expect(tree.exists('libs/lib-one/jest.config.ts')).toBeTruthy();
    await updateJestConfigExt(tree);
    expect(tree.exists('libs/lib-one/jest.config.ts')).toBeTruthy();
    expect(tree.exists('libs/lib-two/jest.config.ts')).toBeFalsy();
    expect(tree.exists('libs/lib-two/jest.config.json')).toBeTruthy();
    expect(tree.exists('libs/lib-three/jest.config.ts')).toBeTruthy();
  });

  it('should not throw error if file does not exit', async () => {
    await libSetUp(tree);

    tree.delete('libs/lib-one/jest.config.js');
    await updateJestConfigExt(tree);
    expect(tree.exists('libs/lib-one/jest.config.ts')).toBeFalsy();
    expect(tree.exists('libs/lib-one/jest.config.js')).toBeFalsy();
  });

  it('should update correct tsconfigs', async () => {
    await libSetUp(tree);

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
    await libSetUp(tree);

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

  it('should update the excludes of next js apps using the project parser settings', async () => {
    await libSetUp(tree, { ...setupDefaults, setParserOptionsProject: true });

    const projectConfig = readProjectConfiguration(tree, 'lib-one');
    projectConfig.targets['build'] = {
      executor: '@nrwl/next:build',
      options: {},
    };
    updateProjectConfiguration(tree, 'lib-one', projectConfig);
    updateJson(tree, 'libs/lib-one/tsconfig.json', (json) => {
      // simulate nextJS tsconfig;
      json.exclude = ['node_modules'];
      return json;
    });
    const esLintJson = readJson(tree, 'libs/lib-one/.eslintrc.json');
    // make sure the parserOptions are set correctly
    expect(esLintJson.overrides[0]).toMatchSnapshot();

    await updateJestConfigExt(tree);

    const tsconfigSpec = readJson(tree, 'libs/lib-one/tsconfig.spec.json');
    expect(tsconfigSpec.exclude).toEqual(['node_modules']);
  });
});
