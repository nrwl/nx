import { ExecutorContext, logger } from '@nx/devkit';
import {
  getInstalledStorybookVersion,
  pleaseUpgrade,
  storybookConfigExistsCheck,
  storybookMajorVersion,
} from '../../utils/utilities.js';
import type { CLIOptions } from 'storybook/internal/types';
import { gte } from 'semver';

export default async function* storybookExecutor(
  options: CLIOptions,
  context: ExecutorContext
): AsyncGenerator<{
  success: boolean;
  info?: { port: number; baseUrl?: string };
}> {
  const storybookMajor = storybookMajorVersion();
  if (storybookMajor > 0 && storybookMajor <= 7) {
    throw pleaseUpgrade();
  }

  storybookConfigExistsCheck(options.configDir, context.projectName);
  const buildOptions: CLIOptions = options;
  const result = await runInstance(buildOptions);
  yield {
    success: true,
    info: {
      port: result?.['port'],
      baseUrl: `${options.https ? 'https' : 'http'}://${
        options.host ?? 'localhost'
      }:${result?.['port']}`,
    },
  };
  await new Promise<{ success: boolean }>(() => {});
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
  const env = process.env.NODE_ENV ?? 'development';
  process.env.NODE_ENV = env;
  return storybookCore.build({
    ...options,
    mode: 'dev',
  });
}
