import { ExecutorContext, logger } from '@nrwl/devkit';
import * as build from '@storybook/core/standalone';
import 'dotenv/config';
import { showStorybookV5Warning } from '../../utils/utilities';
import { CommonNxStorybookConfig } from '../models';
import {
  getStorybookFrameworkPath,
  isStorybookLT6,
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

  if (isStorybookLT6()) {
    showStorybookV5Warning(options.uiFramework);
  }

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
    outputDir: builderOptions.outputPath,
  };

  return storybookOptions;
}
