import { basename, join, sep } from 'path';
import { tmpdir } from 'os';
import { constants, copyFileSync, mkdtempSync, statSync } from 'fs';

import { buildDevStandalone } from '@storybook/core/server';

import { setStorybookAppProject } from '../utils';
import { ExecutorContext } from '@nrwl/devkit';

export interface StorybookConfig {
  configFolder?: string;
  configPath?: string;
  pluginPath?: string;
  srcRoot?: string;
}

export interface StorybookExecutorOptions {
  uiFramework: string;
  projectBuildConfig?: string;
  config: StorybookConfig;
  host?: string;
  port?: number;
  quiet?: boolean;
  ssl?: boolean;
  sslCert?: string;
  sslKey?: string;
  staticDir?: string[];
  watch?: boolean;
  docsMode?: boolean;
}

try {
  require('dotenv').config();
} catch (e) {}

export default async function* storybookExecutor(
  options: StorybookExecutorOptions,
  context: ExecutorContext
) {
  const frameworkPath = `${options.uiFramework}/dist/server/options`;

  const frameworkOptions = (await import(frameworkPath)).default;
  const option = storybookOptionMapper(options, frameworkOptions, context);
  await runInstance(option);

  yield { success: true };

  // This Promise intentionally never resolves, leaving the process running
  await new Promise<{ success: boolean }>(() => {});
}

function runInstance(options: StorybookExecutorOptions) {
  return buildDevStandalone({ ...options, ci: true });
}

function storybookOptionMapper(
  builderOptions: StorybookExecutorOptions,
  frameworkOptions: any,
  context: ExecutorContext
) {
  setStorybookAppProject(context, builderOptions.projectBuildConfig);

  const storybookConfig = findOrCreateConfig(builderOptions.config, context);
  const optionsWithFramework = {
    ...builderOptions,
    mode: 'dev',
    configDir: storybookConfig,
    ...frameworkOptions,
    frameworkPresets: [...(frameworkOptions.frameworkPresets || [])],
  };
  optionsWithFramework.config;
  return optionsWithFramework;
}

function findOrCreateConfig(
  config: StorybookConfig,
  context: ExecutorContext
): string {
  const sourceRoot = context.workspace.projects[context.projectName].root;

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
  } else if (
    statSync(join(context.root, sourceRoot, '.storybook')).isDirectory()
  ) {
    return join(context.root, sourceRoot, '.storybook');
  }
  throw new Error('No configuration settings');
}

function createStorybookConfig(
  configPath: string,
  pluginPath: string,
  srcRoot: string
): string {
  const tmpDir = tmpdir();
  const tmpFolder = `${tmpDir}${sep}`;
  mkdtempSync(tmpFolder);
  copyFileSync(
    configPath,
    `${tmpFolder}/${basename(configPath)}`,
    constants.COPYFILE_EXCL
  );
  copyFileSync(
    pluginPath,
    `${tmpFolder}/${basename(pluginPath)}`,
    constants.COPYFILE_EXCL
  );
  copyFileSync(
    srcRoot,
    `${tmpFolder}/${basename(srcRoot)}`,
    constants.COPYFILE_EXCL
  );
  return tmpFolder;
}
