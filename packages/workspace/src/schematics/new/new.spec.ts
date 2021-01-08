import { createTree } from '@nrwl/devkit/testing';
import { readJson, Tree } from '@nrwl/devkit';
import { newGenerator, Preset, Schema } from './new';
import { Linter } from '../../utils/lint';

const defaultOptions: Omit<Schema, 'name' | 'directory' | 'appName'> = {
  cli: 'nx',
  preset: Preset.Empty,
  skipInstall: false,
  skipGit: false,
  linter: Linter.EsLint,
  defaultBase: 'master',
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
        beforeEach(async () => {
          await newGenerator(tree, {
            ...defaultOptions,
            name: 'my-workspace',
            directory: 'my-workspace',
            npmScope: 'npmScope',
            appName: 'app',
            preset,
          });
        });

        it('should generate necessary npm dependencies', () => {
          expect(readJson(tree, 'my-workspace/package.json')).toMatchSnapshot();
        });
      }
    );
  });
});
