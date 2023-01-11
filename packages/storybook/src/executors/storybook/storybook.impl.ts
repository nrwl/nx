import { ExecutorContext, readJsonFile, workspaceRoot } from '@nrwl/devkit';
import * as build from '@storybook/core-server';
import 'dotenv/config';
import { storybookConfigExists } from '../../utils/utilities';
import { CommonNxStorybookConfig } from '../models';
import {
  getStorybookFrameworkPath,
  resolveCommonStorybookOptionMapper,
  runStorybookSetupCheck,
  isStorybookV7,
} from '../utils';
import {
  CLIOptions,
  LoadOptions,
  BuilderOptions,
  PackageJson,
} from '@storybook/types'; // TODO (katerina): Remove when Storybook 7
import path = require('path');

export interface StorybookExecutorOptions extends CommonNxStorybookConfig {
  host?: string;
  port?: number;
  quiet?: boolean;
  https?: boolean;
  sslCert?: string;
  sslKey?: string;
  staticDir?: string[];
  watch?: boolean;
  docsMode?: boolean;
}

export default async function* storybookExecutor(
  options: StorybookExecutorOptions,
  context: ExecutorContext
): AsyncGenerator<{ success: boolean }> {
  const storybook7 = isStorybookV7();
  if (storybook7) {
    storybookConfigExists(options.config, context.projectName);
    const packageJson = readJsonFile(
      path.join(workspaceRoot, 'package.json')
    ) as PackageJson;
    const buildOptions = {
      ...options,
      workspaceRoot: context.root,
      configDir: options.config.configFolder,
      mode: 'dev',
      packageJson,
      watch: true,
      ignorePreview: options['ignorePreview'] ?? false,
      cache: options['cache'] ?? false,
    } as CLIOptions & LoadOptions & BuilderOptions;

    await runInstance(buildOptions, storybook7);
    yield { success: true };
    // This Promise intentionally never resolves, leaving the process running
    await new Promise<{ success: boolean }>(() => {});
  } else {
    // TODO (katerina): Remove when Storybook 7
    let frameworkPath = getStorybookFrameworkPath(options.uiFramework);
    const frameworkOptions = (await import(frameworkPath)).default;

    const option = storybookOptionMapper(options, frameworkOptions, context);

    // print warnings
    runStorybookSetupCheck(options);

    await runInstance(option, storybook7);

    yield { success: true };

    // This Promise intentionally never resolves, leaving the process running
    await new Promise<{ success: boolean }>(() => {});
  }
}

function runInstance(
  options: CLIOptions & LoadOptions & BuilderOptions,
  storybook7: boolean
) {
  const env = process.env.NODE_ENV ?? 'development';
  process.env.NODE_ENV = env;

  if (storybook7) {
    return build.buildDevStandalone({
      ...options,
      configType: env.toUpperCase(),
    } as any); // TODO (katerina): Change to actual types when Storybook 7
  } else {
    // TODO (katerina): Remove when Storybook 7
    return build.buildDev({
      ...options,
      configType: env.toUpperCase(),
    } as any);
  }
}

// TODO (katerina): Remove when Storybook 7
function storybookOptionMapper(
  builderOptions: StorybookExecutorOptions,
  frameworkOptions: any,
  context: ExecutorContext
) {
  const storybookOptions = {
    ...builderOptions,
    ...resolveCommonStorybookOptionMapper(
      builderOptions,
      frameworkOptions,
      context
    ),
    mode: 'dev',
    watch: true,
  };

  return storybookOptions;
}
