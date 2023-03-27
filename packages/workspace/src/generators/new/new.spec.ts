import { readJson, Tree, writeJson } from '@nrwl/devkit';
import { createTree } from '@nrwl/devkit/testing';
import { Linter } from '../../utils/lint';
import {
  angularCliVersion,
  nxVersion,
  typescriptVersion,
} from '../../utils/versions';
import { Preset } from '../utils/presets';
import { newGenerator, NormalizedSchema } from './new';

const defaultOptions: Omit<
  NormalizedSchema,
  'name' | 'directory' | 'appName' | 'isCustomPreset'
> = {
  preset: Preset.Apps,
  skipInstall: false,
  linter: Linter.EsLint,
  defaultBase: 'main',
};

describe('new', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTree();
  });

  it('should generate an empty nx.json', async () => {
    await newGenerator(tree, {
      ...defaultOptions,
      name: 'my-workspace',
      directory: 'my-workspace',
      npmScope: 'npmScope',
      appName: 'app',
    });
    expect(readJson(tree, 'my-workspace/nx.json')).toMatchSnapshot();
  });

  describe('--preset', () => {
    it('should generate necessary npm dependencies for empty preset', async () => {
      await newGenerator(tree, {
        ...defaultOptions,
        name: 'my-workspace',
        directory: 'my-workspace',
        npmScope: 'npmScope',
        appName: 'app',
        preset: Preset.Empty,
      });

      expect(readJson(tree, 'my-workspace/package.json')).toMatchSnapshot();
    });

    it('should generate necessary npm dependencies for react preset', async () => {
      await newGenerator(tree, {
        ...defaultOptions,
        name: 'my-workspace',
        directory: 'my-workspace',
        npmScope: 'npmScope',
        appName: 'app',
        preset: Preset.ReactMonorepo,
        bundler: 'vite',
      });

      const { devDependencies } = readJson(tree, 'my-workspace/package.json');
      expect(devDependencies).toStrictEqual({
        '@nrwl/react': nxVersion,
        '@nrwl/cypress': nxVersion,
        '@nrwl/vite': nxVersion,
        '@nrwl/workspace': nxVersion,
        nx: nxVersion,
      });
    });

    it('should generate necessary npm dependencies for angular preset', async () => {
      await newGenerator(tree, {
        ...defaultOptions,
        name: 'my-workspace',
        directory: 'my-workspace',
        npmScope: 'npmScope',
        appName: 'app',
        preset: Preset.AngularMonorepo,
      });

      const { devDependencies, dependencies } = readJson(
        tree,
        'my-workspace/package.json'
      );
      expect(dependencies).toStrictEqual({ '@nrwl/angular': nxVersion });
      expect(devDependencies).toStrictEqual({
        '@angular-devkit/core': angularCliVersion,
        '@nrwl/workspace': nxVersion,
        nx: nxVersion,
        typescript: typescriptVersion,
      });
    });
  });

  it('should not modify any existing files', async () => {
    const packageJson = {
      dependencies: {
        existing: 'latest',
      },
    };
    const eslintConfig = {
      rules: {},
    };
    writeJson(tree, 'package.json', packageJson);
    writeJson(tree, '.eslintrc.json', eslintConfig);

    await newGenerator(tree, {
      ...defaultOptions,
      name: 'my-workspace',
      directory: 'my-workspace',
      npmScope: 'npmScope',
      appName: 'app',
    });

    expect(readJson(tree, 'package.json')).toEqual(packageJson);
    expect(readJson(tree, '.eslintrc.json')).toEqual(eslintConfig);
  });

  it('should throw an error when the directory is not empty', async () => {
    tree.write('my-workspace/file.txt', '');

    try {
      await newGenerator(tree, {
        ...defaultOptions,
        name: 'my-workspace',
        directory: 'my-workspace',
        npmScope: 'npmScope',
        appName: 'app',
      });
      fail('Generating into a non-empty directory should error.');
    } catch (e) {}
  });
});
