import 'nx/src/internal-testing-utils/mock-project-graph';

import { NxJsonConfiguration, readJson, Tree, updateJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { LinterInitOptions, lintInitGenerator } from './init';
import { setWorkspaceRoot } from 'nx/src/utils/workspace-root';

describe('@nx/eslint:init', () => {
  let tree: Tree;
  let options: LinterInitOptions;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    setWorkspaceRoot(tree.root);
    options = {
      addPlugin: true,
    };
  });

  it('should not generate the global eslint config if it already exist', async () => {
    tree.write('.eslintrc.js', '{}');

    await lintInitGenerator(tree, options);

    expect(tree.exists('.eslintrc.json')).toBe(false);
  });

  it('should setup @nx/eslint/plugin', async () => {
    updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
      json.namedInputs ??= {};
      json.namedInputs.production = ['default'];
      return json;
    });

    await lintInitGenerator(tree, options);

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

  it('should add @nx/eslint/plugin', async () => {
    updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
      json.namedInputs ??= {};
      json.namedInputs.production = ['default'];
      return json;
    });

    await lintInitGenerator(tree, options);
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

  describe('(legacy)', () => {
    it('should add the root eslint config to the lint targetDefaults for lint', async () => {
      await lintInitGenerator(tree, { ...options, addPlugin: false });

      expect(
        readJson(tree, 'nx.json').targetDefaults['@nx/eslint:lint']
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

    it('should setup lint target defaults', async () => {
      updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
        json.namedInputs ??= {};
        json.namedInputs.production = ['default'];
        return json;
      });

      await lintInitGenerator(tree, { ...options, addPlugin: false });

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
  });
});
