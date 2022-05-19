import { ExecutorContext, logger } from '@nrwl/devkit';
import * as build from '@storybook/core/standalone';
import 'dotenv/config';
import { CommonNxStorybookConfig } from '../models';
import {
  getStorybookFrameworkPath,
  resolveCommonStorybookOptionMapper,
  runStorybookSetupCheck,
} from '../utils';

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
  const env = process.env.NODE_ENV ?? 'production';
  process.env.NODE_ENV = env;
  return build({
    ...options,
    ci: true,
    configType: env.toUpperCase(),
  });
}

function storybookOptionMapper(
  builderOptions: StorybookBuilderOptions,
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
    mode: 'static',
    outputDir: builderOptions.outputPath,
  };

  return storybookOptions;
}
