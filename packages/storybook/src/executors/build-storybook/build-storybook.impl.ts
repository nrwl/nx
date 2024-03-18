import { ExecutorContext, logger } from '@nx/devkit';
import * as build from '@storybook/core-server';
import { CLIOptions } from '@storybook/types';
import {
  pleaseUpgrade,
  storybookConfigExistsCheck,
  storybookMajorVersion,
} from '../../utils/utilities';

export default async function buildStorybookExecutor(
  options: CLIOptions,
  context: ExecutorContext
) {
  storybookConfigExistsCheck(options.configDir, context.projectName);
  const storybook7 = storybookMajorVersion() >= 7;
  if (!storybook7) {
    throw pleaseUpgrade();
  }
  const buildOptions: CLIOptions = options;
  logger.info(`NX Storybook builder starting ...`);
  await runInstance(buildOptions);
  logger.info(`NX Storybook builder finished ...`);
  logger.info(`NX Storybook files available in ${buildOptions.outputDir}`);
  return { success: true };
}

function runInstance(options: CLIOptions): Promise<void | {
  port: number;
  address: string;
  networkAddress: string;
}> {
  const env = process.env.NODE_ENV ?? 'production';
  process.env.NODE_ENV = env;
  return build.build({
    ...options,
    mode: 'static',
  });
}
