import { ExecutorContext, logger } from '@nrwl/devkit';
import { buildDevStandalone } from '@storybook/core/server';
import 'dotenv/config';
import { showStorybookV5Warning } from '../../utils/utilities';
import { CommonNxStorybookConfig } from '../models';
import {
  getStorybookFrameworkPath,
  normalizeAngularBuilderStylesOptions,
  resolveCommonStorybookOptionMapper,
  runStorybookSetupCheck,
  isStorybookLT6,
} from '../utils';
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
  let frameworkPath = getStorybookFrameworkPath(options.uiFramework);
  const frameworkOptions = (await import(frameworkPath)).default;

  options = normalizeAngularBuilderStylesOptions(options, options.uiFramework);
  const option = storybookOptionMapper(options, frameworkOptions, context);

  // print warnings
  runStorybookSetupCheck(options);

  if (isStorybookLT6()) {
    showStorybookV5Warning(options.uiFramework);
  }

  await runInstance(option);

  yield { success: true };

  // This Promise intentionally never resolves, leaving the process running
  await new Promise<{ success: boolean }>(() => {});
}

function runInstance(options: StorybookExecutorOptions) {
  const env = process.env.NODE_ENV ?? 'development';
  process.env.NODE_ENV = env;
  return buildDevStandalone({
    ...options,
    ci: true,
    configType: env.toUpperCase(),
  } as any).catch((error) => {
    // TODO(juri): find a better cleaner way to handle these. Taken from:
    // https://github.com/storybookjs/storybook/blob/dea23e5e9a3e7f5bb25cb6520d3011cc710796c8/lib/core-server/src/build-dev.ts#L138-L166
    if (error instanceof Error) {
      if ((error as any).error) {
        logger.error((error as any).error);
      } else if (
        (error as any).stats &&
        (error as any).stats.compilation.errors
      ) {
        (error as any).stats.compilation.errors.forEach((e: any) =>
          logger.log(e)
        );
      } else {
        logger.error(error as any);
      }
    } else if (error.compilation?.errors) {
      error.compilation.errors.forEach((e: any) => logger.log(e));
    }

    logger.log('');
    logger.warn(
      error.close
        ? `
          FATAL broken build!, will close the process,
          Fix the error below and restart storybook.
        `
        : `
          Broken build, fix the error above.
          You may need to refresh the browser.
        `
    );

    process.exit(1);
  });
}

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
