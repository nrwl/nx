import 'dotenv/config';
import { basename, join, sep } from 'path';
import { tmpdir } from 'os';
import { constants, copyFileSync, mkdtempSync, statSync } from 'fs';

import * as build from '@storybook/core/standalone';

import {
  getStorybookFrameworkPath,
  runStorybookSetupCheck,
  setStorybookAppProject,
} from '../utils';
import { ExecutorContext, logger } from '@nrwl/devkit';
import { CommonNxStorybookConfig, StorybookConfig } from '../models';

export interface StorybookBuilderOptions extends CommonNxStorybookConfig {
  quiet?: boolean;
  outputPath?: string;
  docsMode?: boolean;
}

export default async function buildStorybookExecutor(
  options: StorybookBuilderOptions,
  context: ExecutorContext
) {
  logger.info(`NX ui framework: ${options.uiFramework}`);

  const frameworkPath = getStorybookFrameworkPath(options.uiFramework);

  const { default: frameworkOptions } = await import(frameworkPath);
  const option = storybookOptionMapper(options, frameworkOptions, context);

  // print warnings
  runStorybookSetupCheck(options);

  logger.info(`NX Storybook builder starting ...`);
  await runInstance(option);
  logger.info(`NX Storybook builder finished ...`);
  logger.info(`NX Storybook files available in ${options.outputPath}`);
  return { success: true };
}

function runInstance(options: StorybookBuilderOptions): Promise<void> {
  return build({ ...options, ci: true });
}

function storybookOptionMapper(
  builderOptions: StorybookBuilderOptions,
  frameworkOptions: any,
  context: ExecutorContext
) {
  setStorybookAppProject(context, builderOptions.projectBuildConfig);

  const storybookConfig = findOrCreateConfig(builderOptions.config, context);
  const optionsWithFramework = {
    ...builderOptions,
    mode: 'static',
    outputDir: builderOptions.outputPath,
    workspaceRoot: context.root,
    configDir: storybookConfig,
    ...frameworkOptions,
    frameworkPresets: [...(frameworkOptions.frameworkPresets || [])],
    watch: false,
  };
  optionsWithFramework.config;
  return optionsWithFramework;
}

function findOrCreateConfig(
  config: StorybookConfig,
  context: ExecutorContext
): string {
  if (config.configFolder && statSync(config.configFolder).isDirectory()) {
    return config.configFolder;
  } else if (
    statSync(config.configPath).isFile() &&
    statSync(config.pluginPath).isFile() &&
    statSync(config.srcRoot).isFile()
  ) {
    return createStorybookConfig(
      config.configPath,
      config.pluginPath,
      config.srcRoot
    );
  } else {
    const sourceRoot = context.workspace.projects[context.projectName].root;
    if (statSync(join(context.root, sourceRoot, '.storybook')).isDirectory()) {
      return join(context.root, sourceRoot, '.storybook');
    }
  }
  throw new Error('No configuration settings');
}

function createStorybookConfig(
  configPath: string,
  pluginPath: string,
  srcRoot: string
): string {
  const tmpDir = tmpdir();
  const tmpFolder = mkdtempSync(`${tmpDir}${sep}`);
  copyFileSync(
    configPath,
    `${tmpFolder}${basename(configPath)}`,
    constants.COPYFILE_EXCL
  );
  copyFileSync(
    pluginPath,
    `${tmpFolder}${basename(pluginPath)}`,
    constants.COPYFILE_EXCL
  );
  copyFileSync(
    srcRoot,
    `${tmpFolder}${basename(srcRoot)}`,
    constants.COPYFILE_EXCL
  );
  return tmpFolder;
}
