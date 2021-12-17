import { createTree } from '@nrwl/devkit/testing';
import { readJson, Tree, writeJson, PackageManager } from '@nrwl/devkit';
import { newGenerator, Schema } from './new';
import { Linter } from '../../utils/lint';
import { Preset } from '../utils/presets';

const defaultOptions: Omit<Schema, 'name' | 'directory' | 'appName'> = {
  cli: 'nx',
  preset: Preset.Apps,
  skipInstall: false,
  skipGit: false,
  linter: Linter.EsLint,
  defaultBase: 'main',
};

describe('new', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTree();
  });

  it('should generate an empty workspace.json', async () => {
    await newGenerator(tree, {
      ...defaultOptions,
      name: 'my-workspace',
      directory: 'my-workspace',
      npmScope: 'npmScope',
      appName: 'app',
    });
    expect(readJson(tree, 'my-workspace/workspace.json')).toMatchSnapshot();
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
    describe.each([[Preset.Empty], [Preset.Angular], [Preset.React]])(
      '%s',
      (preset) => {
        it('should generate necessary npm dependencies', async () => {
          await newGenerator(tree, {
            ...defaultOptions,
            name: 'my-workspace',
            directory: 'my-workspace',
            npmScope: 'npmScope',
            appName: 'app',
            preset,
          });

          expect(readJson(tree, 'my-workspace/package.json')).toMatchSnapshot();
        });
      }
    );
  });

  describe('--packageManager', () => {
    describe.each([['npm'], ['yarn'], ['pnpm']])(
      '%s',
      (packageManager: PackageManager) => {
        it('should set the packageManager in nx.json', async () => {
          await newGenerator(tree, {
            ...defaultOptions,
            name: 'my-workspace',
            directory: 'my-workspace',
            npmScope: 'npmScope',
            appName: 'app',
            cli: 'angular',
            packageManager,
          });

          const nxJson = readJson(tree, 'my-workspace/nx.json');
          expect(nxJson.cli.packageManager).toEqual(packageManager);
        });
      }
    );
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
