import { ExecutorContext, logger } from '@nrwl/devkit';
import * as build from '@storybook/core/standalone';
import 'dotenv/config';
import { join } from 'path';
import { CommonNxStorybookConfig } from '../models';
import {
  getStorybookFrameworkPath,
  normalizeAngularBuilderStylesOptions,
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

  options = normalizeAngularBuilderStylesOptions(options, options.uiFramework);
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
  const storybookOptions = {
    ...builderOptions,
    ...resolveCommonStorybookOptionMapper(
      builderOptions,
      frameworkOptions,
      context
    ),
    mode: 'static',
    // ensure that Storybook outputs resources to the same dir regardless of the pwd from
    // which the command is executed
    outputDir: join(context.root, builderOptions.outputPath),
  };

  return storybookOptions;
}
