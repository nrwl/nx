import 'nx/src/internal-testing-utils/mock-project-graph';

import {
  NxJsonConfiguration,
  readJson,
  type TargetConfiguration,
  type TargetDefaults,
  Tree,
  updateJson,
  writeJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { LinterInitOptions, lintInitGenerator } from './init';
import { setWorkspaceRoot } from 'nx/src/utils/workspace-root';

function getDefault(
  td: TargetDefaults | undefined,
  target: string
): Partial<TargetConfiguration> | undefined {
  if (!td) return undefined;
  if (Array.isArray(td)) {
    const found = td.find(
      (e) =>
        (e.target === target || e.executor === target) &&
        e.projects === undefined &&
        e.plugin === undefined
    );
    if (!found) return undefined;
    const {
      target: _t,
      executor: _e,
      projects: _p,
      plugin: _pl,
      ...rest
    } = found;
    return rest;
  }
  return td[target];
}

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
      getDefault(
        readJson<NxJsonConfiguration>(tree, 'nx.json').targetDefaults,
        '@nx/eslint:lint'
      )
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

  it('should add the eslint extension to the recommended property', async () => {
    writeJson(tree, '.vscode/extensions.json', {
      recommendations: [
        'nrwl.angular-console',
        'angular.ng-template',
        'esbenp.prettier-vscode',
      ],
    });

    await lintInitGenerator(tree, options);
    expect(readJson(tree, '.vscode/extensions.json')).toMatchInlineSnapshot(`
      {
        "recommendations": [
          "nrwl.angular-console",
          "angular.ng-template",
          "esbenp.prettier-vscode",
          "dbaeumer.vscode-eslint",
        ],
      }
    `);
  });

  describe('(legacy)', () => {
    describe('CJS', () => {
      it('should add the root eslint config to the lint targetDefaults for lint', async () => {
        await lintInitGenerator(tree, {
          ...options,
          addPlugin: false,
          eslintConfigFormat: 'cjs',
        });

        expect(
          getDefault(
            readJson<NxJsonConfiguration>(tree, 'nx.json').targetDefaults,
            '@nx/eslint:lint'
          )
        ).toEqual({
          cache: true,
          inputs: [
            'default',
            '^default',
            '{workspaceRoot}/.eslintrc.json',
            '{workspaceRoot}/.eslintignore',
            '{workspaceRoot}/eslint.config.cjs',
            '{workspaceRoot}/tools/eslint-rules/**/*',
          ],
        });
      });

      it('should setup lint target defaults', async () => {
        updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
          json.namedInputs ??= {};
          json.namedInputs.production = ['default'];
          return json;
        });

        await lintInitGenerator(tree, {
          ...options,
          addPlugin: false,
          eslintConfigFormat: 'cjs',
        });

        expect(
          getDefault(
            readJson<NxJsonConfiguration>(tree, 'nx.json').targetDefaults,
            '@nx/eslint:lint'
          )
        ).toEqual({
          cache: true,
          inputs: [
            'default',
            '^default',
            '{workspaceRoot}/.eslintrc.json',
            '{workspaceRoot}/.eslintignore',
            '{workspaceRoot}/eslint.config.cjs',
            '{workspaceRoot}/tools/eslint-rules/**/*',
          ],
        });
      });
    });

    describe('MJS', () => {
      it('should add the root eslint config to the lint targetDefaults for lint', async () => {
        await lintInitGenerator(tree, {
          ...options,
          addPlugin: false,
          eslintConfigFormat: 'mjs',
        });

        expect(
          getDefault(
            readJson<NxJsonConfiguration>(tree, 'nx.json').targetDefaults,
            '@nx/eslint:lint'
          )
        ).toEqual({
          cache: true,
          inputs: [
            'default',
            '^default',
            '{workspaceRoot}/.eslintrc.json',
            '{workspaceRoot}/.eslintignore',
            '{workspaceRoot}/eslint.config.mjs',
            '{workspaceRoot}/tools/eslint-rules/**/*',
          ],
        });
      });

      it('should setup lint target defaults', async () => {
        updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
          json.namedInputs ??= {};
          json.namedInputs.production = ['default'];
          return json;
        });

        await lintInitGenerator(tree, {
          ...options,
          addPlugin: false,
          eslintConfigFormat: 'mjs',
        });

        expect(
          getDefault(
            readJson<NxJsonConfiguration>(tree, 'nx.json').targetDefaults,
            '@nx/eslint:lint'
          )
        ).toEqual({
          cache: true,
          inputs: [
            'default',
            '^default',
            '{workspaceRoot}/.eslintrc.json',
            '{workspaceRoot}/.eslintignore',
            '{workspaceRoot}/eslint.config.mjs',
            '{workspaceRoot}/tools/eslint-rules/**/*',
          ],
        });
      });
    });
  });
});
