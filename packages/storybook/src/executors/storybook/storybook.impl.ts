import { ExecutorContext, logger } from '@nx/devkit';
import {
  pleaseUpgrade,
  storybookConfigExistsCheck,
  storybookMajorVersion,
} from '../../utils/utilities';
import { CLIOptions } from '@storybook/types';

export default async function* storybookExecutor(
  options: CLIOptions,
  context: ExecutorContext
): AsyncGenerator<{
  success: boolean;
  info?: { port: number; baseUrl?: string };
}> {
  const storybookMajor = storybookMajorVersion();
  if (storybookMajor > 0 && storybookMajor <= 6) {
    throw pleaseUpgrade();
  } else if (storybookMajor === 7) {
    logger.warn(
      `Support for Storybook 7 is deprecated. Please upgrade to Storybook 8. See https://nx.dev/nx-api/storybook/generators/migrate-8 for more details.`
    );
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
  const storybookCore = await import('@storybook/core-server');
  const env = process.env.NODE_ENV ?? 'development';
  process.env.NODE_ENV = env;
  return storybookCore.build({
    ...options,
    mode: 'dev',
  });
}
