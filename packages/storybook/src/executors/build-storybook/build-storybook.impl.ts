import { ExecutorContext, logger } from '@nx/devkit';
import type { CLIOptions } from 'storybook/internal/types';
import {
  pleaseUpgrade,
  storybookConfigExistsCheck,
  storybookMajorVersion,
  getInstalledStorybookVersion,
} from '../../utils/utilities.js';
import { gte } from 'semver';

export default async function buildStorybookExecutor(
  options: CLIOptions,
  context: ExecutorContext
) {
  storybookConfigExistsCheck(options.configDir, context.projectName);
  const storybookMajor = storybookMajorVersion();
  if (storybookMajor > 0 && storybookMajor <= 7) {
    throw pleaseUpgrade();
  }

  const buildOptions: CLIOptions = options;
  logger.info(`NX Storybook builder starting ...`);
  await runInstance(buildOptions);
  logger.info(`NX Storybook builder finished ...`);
  logger.info(`NX Storybook files available in ${buildOptions.outputDir}`);
  return { success: true };
}

async function runInstance(options: CLIOptions): Promise<void | {
  port: number;
  address: string;
  networkAddress: string;
}> {
  const installedStorybookVersion = getInstalledStorybookVersion();
  const hasCoreServerInStorybookPackage = gte(
    installedStorybookVersion,
    '8.2.0'
  );
  const storybookCore = await (hasCoreServerInStorybookPackage
    ? import('storybook/internal/core-server')
    : // This is needed for backwards compatibility - but we do not have the package installed in the nx repo
      // @ts-ignore
      import('@storybook/core-server'));
  const env = process.env.NODE_ENV ?? 'production';
  process.env.NODE_ENV = env;
  return storybookCore.build({
    ...options,
    mode: 'static',
  });
}
