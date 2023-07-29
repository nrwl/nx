import { ExecutorContext, logger } from '@nx/devkit';
import * as build from '@storybook/core-server';
import 'dotenv/config';
import {
  pleaseUpgrade,
  storybookConfigExistsCheck,
  storybookMajorVersion,
} from '../../utils/utilities';
import { getStorybookFrameworkPath, runStorybookSetupCheck } from '../utils';
import { CLIOptions } from '@storybook/types'; // TODO(katerina): Remove Nx17
import { CommonNxStorybookConfig } from '../../utils/models';

export default async function* storybookExecutor(
  options: CLIOptions & CommonNxStorybookConfig,
  context: ExecutorContext
): AsyncGenerator<{
  success: boolean;
  info?: { port: number; baseUrl?: string };
}> {
  const storybook7 = storybookMajorVersion() === 7;
  storybookConfigExistsCheck(options.configDir, context.projectName);
  if (storybook7) {
    const buildOptions: CLIOptions = options;
    const result = await runInstance(buildOptions, storybook7);
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
  } else {
    // TODO(katerina): Remove Nx17
    // print warnings
    runStorybookSetupCheck(options);
    logger.error(pleaseUpgrade());

    let frameworkPath = getStorybookFrameworkPath(options.uiFramework);
    const frameworkOptions = (await import(frameworkPath)).default;
    const buildOptions: CLIOptions = {
      ...options,
      ...frameworkOptions,
      frameworkPresets: [...(frameworkOptions.frameworkPresets || [])],
    };

    await runInstance(buildOptions, storybook7);
    yield { success: true };
    await new Promise<{ success: boolean }>(() => {});
  }
}

function runInstance(
  options: CLIOptions,
  storybook7: boolean
): Promise<void | {
  port: number;
  address: string;
  networkAddress: string;
}> {
  const env = process.env.NODE_ENV ?? 'development';
  process.env.NODE_ENV = env;
  if (storybook7) {
    return build.build({
      ...options,
      mode: 'dev',
    });
  } else {
    // TODO(katerina): Remove Nx17
    return build['buildDev']({
      ...options,
      configType: env.toUpperCase(),
      mode: 'dev',
    } as any);
  }
}
