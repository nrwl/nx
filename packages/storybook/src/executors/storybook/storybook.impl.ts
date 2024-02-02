import { ExecutorContext } from '@nx/devkit';
import * as build from '@storybook/core-server';
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
  const storybook7 = storybookMajorVersion() >= 7;
  if (!storybook7) {
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

function runInstance(options: CLIOptions): Promise<void | {
  port: number;
  address: string;
  networkAddress: string;
}> {
  const env = process.env.NODE_ENV ?? 'development';
  process.env.NODE_ENV = env;
  return build.build({
    ...options,
    mode: 'dev',
  });
}
