import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import {
  Tree,
  readProjectConfiguration,
  readJson,
  updateJson,
  joinPathFragments,
  writeJson,
} from '@nrwl/devkit';

import type { Linter as ESLint } from 'eslint';
import { Schema as EsLintExecutorOptions } from '@nrwl/linter/src/executors/eslint/schema';

import generator from './generator';
import pluginGenerator from '../plugin/plugin';
import { Linter } from '@nrwl/linter';
import { PackageJson } from 'nx/src/utils/package-json';

describe('lint-checks generator', () => {
  let appTree: Tree;

  beforeEach(async () => {
    appTree = createTreeWithEmptyWorkspace(2);
    await pluginGenerator(appTree, {
      name: 'plugin',
      importPath: '@acme/plugin',
      compiler: 'tsc',
      linter: Linter.EsLint,
      skipFormat: false,
      skipTsConfig: false,
      skipLintChecks: true, // we manually call it s.t. we can update config files first
      unitTestRunner: 'jest',
    });
  });

  it('should update configuration files for default plugin', async () => {
    await generator(appTree, { projectName: 'plugin' });
    const projectConfig = readProjectConfiguration(appTree, 'plugin');
    const targetConfig = projectConfig.targets?.['lint'];
    const eslintConfig: ESLint.Config = readJson(
      appTree,
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
          '@nrwl/nx/nx-plugin-checks': 'error',
        },
      })
    );
  });

  it('should not duplicate configuration', async () => {
    await generator(appTree, { projectName: 'plugin' });
    await generator(appTree, { projectName: 'plugin' });
    const projectConfig = readProjectConfiguration(appTree, 'plugin');
    const targetConfig = projectConfig.targets?.['lint']
      .options as EsLintExecutorOptions;
    const eslintConfig: ESLint.Config = readJson(
      appTree,
      `${projectConfig.root}/.eslintrc.json`
    );

    const uniqueLintFilePatterns = new Set(targetConfig.lintFilePatterns);

    expect(targetConfig.lintFilePatterns).toHaveLength(
      uniqueLintFilePatterns.size
    );

    expect(
      eslintConfig.overrides.filter(
        (x) => '@nrwl/nx/nx-plugin-checks' in x.rules
      )
    ).toHaveLength(1);
  });

  it('should update configuration files for angular-style plugin', async () => {
    const startingProjectConfig = readProjectConfiguration(appTree, 'plugin');
    updateJson(
      appTree,
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
      appTree,
      joinPathFragments(startingProjectConfig.root, 'migrations.json'),
      {}
    );
    await generator(appTree, { projectName: 'plugin' });
    const projectConfig = readProjectConfiguration(appTree, 'plugin');
    const targetConfig = projectConfig.targets?.['lint'];
    const eslintConfig: ESLint.Config = readJson(
      appTree,
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
          '@nrwl/nx/nx-plugin-checks': 'error',
        },
      })
    );
  });
});
