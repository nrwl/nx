import 'nx/src/internal-testing-utils/mock-project-graph';

import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  Tree,
  readProjectConfiguration,
  readJson,
  updateJson,
  joinPathFragments,
  writeJson,
} from '@nx/devkit';

import type { Linter as ESLint } from 'eslint';
import { Linter } from '@nx/eslint';

import generator from './generator';
import pluginGenerator from '../plugin/plugin';
import generatorGenerator from '../generator/generator';
import executorGenerator from '../executor/executor';

import { PackageJson } from 'nx/src/utils/package-json';

describe('lint-checks generator', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    await pluginGenerator(tree, {
      directory: 'plugin',
      importPath: '@acme/plugin',
      compiler: 'tsc',
      linter: Linter.EsLint,
      skipFormat: false,
      skipTsConfig: false,
      skipLintChecks: true, // we manually call it s.t. we can update config files first
      unitTestRunner: 'jest',
    });
    await generatorGenerator(tree, {
      name: 'my-generator',
      path: 'plugin/src/generators/my-generator',
      unitTestRunner: 'jest',
      skipLintChecks: true,
    });
    await executorGenerator(tree, {
      name: 'my-executor',
      path: 'plugin/src/executors/my-executor',
      unitTestRunner: 'jest',
      includeHasher: false,
      skipLintChecks: true,
    });
  });

  it('should update configuration files for default plugin', async () => {
    await generator(tree, { projectName: 'plugin' });

    const projectConfig = readProjectConfiguration(tree, 'plugin');
    const eslintConfig: ESLint.Config = readJson(
      tree,
      `${projectConfig.root}/.eslintrc.json`
    );

    expect(eslintConfig.overrides).toContainEqual(
      expect.objectContaining({
        files: expect.arrayContaining([
          './executors.json',
          './package.json',
          './generators.json',
        ]),
        rules: {
          '@nx/nx-plugin-checks': 'error',
        },
      })
    );
  });

  it('should not duplicate configuration', async () => {
    await generator(tree, { projectName: 'plugin' });
    await generator(tree, { projectName: 'plugin' });
    const projectConfig = readProjectConfiguration(tree, 'plugin');
    const eslintConfig: ESLint.Config = readJson(
      tree,
      `${projectConfig.root}/.eslintrc.json`
    );

    expect(
      eslintConfig.overrides.find((x) => '@nx/nx-plugin-checks' in x.rules)
    ).toMatchInlineSnapshot(`
      {
        "files": [
          "./package.json",
          "./generators.json",
          "./executors.json",
        ],
        "parser": "jsonc-eslint-parser",
        "rules": {
          "@nx/nx-plugin-checks": "error",
        },
      }
    `);
  });

  it('should update configuration files for angular-style plugin', async () => {
    const startingProjectConfig = readProjectConfiguration(tree, 'plugin');
    updateJson(
      tree,
      joinPathFragments(startingProjectConfig.root, 'package.json'),
      (json: PackageJson) => {
        json.schematics = './collection.json';
        delete json.generators;
        json.builders = './builders.json';
        delete json.executors;
        json['ng-update'] = './migrations.json';
        return json;
      }
    );
    writeJson(
      tree,
      joinPathFragments(startingProjectConfig.root, 'migrations.json'),
      {}
    );
    await generator(tree, { projectName: 'plugin' });
    const projectConfig = readProjectConfiguration(tree, 'plugin');
    const eslintConfig: ESLint.Config = readJson(
      tree,
      `${projectConfig.root}/.eslintrc.json`
    );

    expect(eslintConfig.overrides).toMatchInlineSnapshot(`
      [
        {
          "files": [
            "*.ts",
            "*.tsx",
            "*.js",
            "*.jsx",
          ],
          "rules": {},
        },
        {
          "files": [
            "*.ts",
            "*.tsx",
          ],
          "rules": {},
        },
        {
          "files": [
            "*.js",
            "*.jsx",
          ],
          "rules": {},
        },
        {
          "files": [
            "*.json",
          ],
          "parser": "jsonc-eslint-parser",
          "rules": {
            "@nx/dependency-checks": [
              "error",
              {
                "ignoredFiles": [
                  "{projectRoot}/eslint.config.{js,cjs,mjs}",
                ],
              },
            ],
          },
        },
        {
          "files": [
            "./package.json",
            "./collection.json",
            "./builders.json",
            "./migrations.json",
          ],
          "parser": "jsonc-eslint-parser",
          "rules": {
            "@nx/nx-plugin-checks": "error",
          },
        },
      ]
    `);
  });
});
