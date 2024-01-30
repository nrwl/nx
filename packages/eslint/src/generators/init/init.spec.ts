import { Linter } from '../utils/linter';
import { NxJsonConfiguration, readJson, Tree, updateJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { lintInitGenerator } from './init';

describe('@nx/eslint:init', () => {
  let tree: Tree;
  let envV3: string | undefined;

  beforeEach(() => {
    envV3 = process.env.NX_PCV3;
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  afterEach(() => {
    process.env.NX_PCV3 = envV3;
  });

  it('should add the root eslint config to the lint targetDefaults for lint', async () => {
    await lintInitGenerator(tree, {});

    expect(readJson(tree, 'nx.json').targetDefaults['@nx/eslint:lint']).toEqual(
      {
        cache: true,
        inputs: [
          'default',
          '{workspaceRoot}/.eslintrc.json',
          '{workspaceRoot}/.eslintignore',
          '{workspaceRoot}/eslint.config.js',
        ],
      }
    );
  });

  it('should not generate the global eslint config if it already exist', async () => {
    tree.write('.eslintrc.js', '{}');

    await lintInitGenerator(tree, {});

    expect(tree.exists('.eslintrc.json')).toBe(false);
  });

  it('should setup lint target defaults', async () => {
    updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
      json.namedInputs ??= {};
      json.namedInputs.production = ['default'];
      return json;
    });

    await lintInitGenerator(tree, {});

    expect(
      readJson<NxJsonConfiguration>(tree, 'nx.json').targetDefaults[
        '@nx/eslint:lint'
      ]
    ).toEqual({
      cache: true,
      inputs: [
        'default',
        '{workspaceRoot}/.eslintrc.json',
        '{workspaceRoot}/.eslintignore',
        '{workspaceRoot}/eslint.config.js',
      ],
    });
  });

  it('should setup @nx/eslint/plugin', async () => {
    process.env.NX_PCV3 = 'true';
    updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
      json.namedInputs ??= {};
      json.namedInputs.production = ['default'];
      return json;
    });

    await lintInitGenerator(tree, {});

    expect(
      readJson<NxJsonConfiguration>(tree, 'nx.json').targetDefaults[
        '@nx/eslint:lint'
      ]
    ).toBeUndefined();
    expect(readJson<NxJsonConfiguration>(tree, 'nx.json').plugins)
      .toMatchInlineSnapshot(`
      [
        {
          "options": {
            "targetName": "lint",
          },
          "plugin": "@nx/eslint/plugin",
        },
      ]
    `);
  });

  it('should add @nx/eslint/plugin in subsequent step', async () => {
    updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
      json.namedInputs ??= {};
      json.namedInputs.production = ['default'];
      return json;
    });

    await lintInitGenerator(tree, {});
    expect(
      readJson<NxJsonConfiguration>(tree, 'nx.json').plugins
    ).not.toBeDefined();

    process.env.NX_PCV3 = 'true';
    lintInitGenerator(tree, {});
    expect(readJson<NxJsonConfiguration>(tree, 'nx.json').plugins)
      .toMatchInlineSnapshot(`
      [
        {
          "options": {
            "targetName": "lint",
          },
          "plugin": "@nx/eslint/plugin",
        },
      ]
    `);
  });
});
