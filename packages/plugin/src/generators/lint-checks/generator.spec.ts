import '@nx/devkit/internal-testing-utils/mock-project-graph';

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

import generator from './generator';
import pluginGenerator from '../plugin/plugin';
import generatorGenerator from '../generator/generator';
import executorGenerator from '../executor/executor';

import { PackageJson } from '@nx/devkit/internal';

describe('lint-checks generator', () => {
  let tree: Tree;
  let envBackup: string | undefined;

  beforeEach(async () => {
    envBackup = process.env.ESLINT_USE_FLAT_CONFIG;
    delete process.env.ESLINT_USE_FLAT_CONFIG;
  });

  afterEach(() => {
    if (envBackup === undefined) delete process.env.ESLINT_USE_FLAT_CONFIG;
    else process.env.ESLINT_USE_FLAT_CONFIG = envBackup;
  });

  async function setupTree(useFlat: boolean) {
    process.env.ESLINT_USE_FLAT_CONFIG = useFlat ? 'true' : 'false';
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    await pluginGenerator(tree, {
      directory: 'plugin',
      importPath: '@acme/plugin',
      compiler: 'tsc',
      linter: 'eslint',
      skipFormat: false,
      skipTsConfig: false,
      skipLintChecks: true, // manually call so we can update config files first
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
  }

  it('should update configuration files for default plugin (eslintrc)', async () => {
    await setupTree(false);
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

  it('should not duplicate configuration (eslintrc)', async () => {
    await setupTree(false);
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

  it('should update configuration files for angular-style plugin (eslintrc)', async () => {
    await setupTree(false);
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
                  "{projectRoot}/eslint.config.{js,cjs,mjs,ts,cts,mts}",
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

  it('should update configuration files for default plugin (flat config)', async () => {
    await setupTree(true);
    await generator(tree, { projectName: 'plugin' });

    const projectConfig = readProjectConfiguration(tree, 'plugin');
    expect(tree.exists(`${projectConfig.root}/eslint.config.mjs`)).toBeTruthy();
    const eslintConfigContent = tree.read(
      `${projectConfig.root}/eslint.config.mjs`,
      'utf-8'
    );
    expect(eslintConfigContent).toContain('@nx/nx-plugin-checks');
  });
});
