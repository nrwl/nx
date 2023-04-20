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
import { Linter } from '@nx/linter';
import { Schema as EsLintExecutorOptions } from '@nx/linter/src/executors/eslint/schema';

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
      name: 'plugin',
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
      project: 'plugin',
      unitTestRunner: 'jest',
      skipLintChecks: true,
    });
    await executorGenerator(tree, {
      name: 'my-executor',
      project: 'plugin',
      unitTestRunner: 'jest',
      includeHasher: false,
      skipLintChecks: true,
    });
  });

  it('should update configuration files for default plugin', async () => {
    await generator(tree, { projectName: 'plugin' });

    const projectConfig = readProjectConfiguration(tree, 'plugin');
    const targetConfig = projectConfig.targets?.['lint'];
    const eslintConfig: ESLint.Config = readJson(
      tree,
      `${projectConfig.root}/.eslintrc.json`
    );

    expect(targetConfig.options.lintFilePatterns).toContain(
      `${projectConfig.root}/generators.json`
    );
    expect(targetConfig.options.lintFilePatterns).toContain(
      `${projectConfig.root}/executors.json`
    );
    expect(targetConfig.options.lintFilePatterns).toContain(
      `${projectConfig.root}/package.json`
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
    const targetConfig = projectConfig.targets?.['lint']
      .options as EsLintExecutorOptions;
    const eslintConfig: ESLint.Config = readJson(
      tree,
      `${projectConfig.root}/.eslintrc.json`
    );

    const uniqueLintFilePatterns = new Set(targetConfig.lintFilePatterns);

    expect(targetConfig.lintFilePatterns).toHaveLength(
      uniqueLintFilePatterns.size
    );

    expect(
      eslintConfig.overrides.filter((x) => '@nx/nx-plugin-checks' in x.rules)
    ).toHaveLength(1);
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
    const targetConfig = projectConfig.targets?.['lint'];
    const eslintConfig: ESLint.Config = readJson(
      tree,
      `${projectConfig.root}/.eslintrc.json`
    );

    expect(targetConfig.options.lintFilePatterns).not.toContain(
      `${projectConfig.root}/generators.json`
    );
    expect(targetConfig.options.lintFilePatterns).toContain(
      `${projectConfig.root}/collection.json`
    );
    expect(targetConfig.options.lintFilePatterns).not.toContain(
      `${projectConfig.root}/executors.json`
    );
    expect(targetConfig.options.lintFilePatterns).toContain(
      `${projectConfig.root}/builders.json`
    );
    expect(targetConfig.options.lintFilePatterns).toContain(
      `${projectConfig.root}/migrations.json`
    );
    expect(eslintConfig.overrides).toContainEqual(
      expect.objectContaining({
        files: expect.arrayContaining([
          './collection.json',
          './package.json',
          './builders.json',
          './migrations.json',
        ]),
        rules: {
          '@nx/nx-plugin-checks': 'error',
        },
      })
    );
  });
});
