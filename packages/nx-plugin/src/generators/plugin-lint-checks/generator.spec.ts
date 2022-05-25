import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { Tree, readProjectConfiguration, readJson } from '@nrwl/devkit';

import type { Linter as ESLint } from 'eslint';

import generator from './generator';
import pluginGenerator from '../plugin/plugin';
import { Linter } from '@nrwl/linter';

describe('plugin-lint generator', () => {
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
      unitTestRunner: 'jest',
    });
  });

  it('should update configuration files', async () => {
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
        files: ['executors.json', 'package.json', 'generators.json'],
        rules: {
          '@nrwl/nx/nx-plugin-checks': 'error',
        },
      })
    );
  });
});
