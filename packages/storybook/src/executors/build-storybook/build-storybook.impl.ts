import {
  ExecutorContext,
  logger,
  readJsonFile,
  workspaceRoot,
} from '@nrwl/devkit';
import * as build from '@storybook/core-server';
import {
  CLIOptions,
  LoadOptions,
  BuilderOptions,
  PackageJson,
} from '@storybook/types'; // TODO (katerina): Remove when Storybook 7
import 'dotenv/config';
import path = require('path');
import { storybookConfigExists } from '../../utils/utilities';
import { CommonNxStorybookConfig } from '../models';
import {
  getStorybookFrameworkPath,
  isStorybookV7,
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
      packageJson,
      watch: false,
      mode: options?.['mode'] ?? 'static',
      outputDir:
        (options?.['outputDir'] || options?.['output-dir']) ??
        options.outputPath,
      ignorePreview: options['ignorePreview'] ?? false,
      cache: options['cache'] ?? false,
    } as CLIOptions &
      LoadOptions &
      BuilderOptions & {
        outputDir: string;
      };

    logger.info(`NX Storybook builder starting ...`);
    await runInstance(buildOptions);
    logger.info(`NX Storybook builder finished ...`);
    logger.info(`NX Storybook files available in ${options.outputPath}`);
    return { success: true };
  } else {
    // TODO (katerina): Remove when Storybook 7
    logger.info(`NX ui framework: ${options.uiFramework}`);

    const frameworkPath = getStorybookFrameworkPath(options.uiFramework);
    const { default: frameworkOptions } = await import(frameworkPath);

    const buildOptions = storybookOptionMapper(
      options,
      frameworkOptions,
      context
    );

    // print warnings
    runStorybookSetupCheck(options);

    logger.info(`NX Storybook builder starting ...`);
    await runInstance(buildOptions);
    logger.info(`NX Storybook builder finished ...`);
    logger.info(`NX Storybook files available in ${options.outputPath}`);
    return { success: true };
  }
}

function runInstance(
  options: CLIOptions &
    LoadOptions &
    BuilderOptions & {
      outputDir: string;
    }
): Promise<void> {
  const env = process.env.NODE_ENV ?? 'production';
  process.env.NODE_ENV = env;

  return build.buildStaticStandalone({
    ...options,
    ci: true,
  } as any); // TODO (katerina): Change to actual types when Storybook 7
}

// TODO (katerina): Remove when Storybook 7
function storybookOptionMapper(
  builderOptions: StorybookBuilderOptions,
  frameworkOptions: any,
  context: ExecutorContext
): CLIOptions &
  LoadOptions &
  BuilderOptions & {
    outputDir: string;
  } {
  const storybookOptions = {
    ...builderOptions,
    ...resolveCommonStorybookOptionMapper(
      builderOptions,
      frameworkOptions,
      context
    ),
    mode: builderOptions?.['mode'] ?? 'static',
    outputDir:
      (builderOptions?.['outputDir'] || builderOptions?.['output-dir']) ??
      builderOptions.outputPath,
  };

  return storybookOptions;
}
