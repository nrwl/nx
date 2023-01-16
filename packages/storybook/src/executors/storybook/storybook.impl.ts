import { ExecutorContext } from '@nrwl/devkit';
import * as build from '@storybook/core-server';
import 'dotenv/config';
import {
  isStorybookV7,
  storybookConfigExistsCheck,
} from '../../utils/utilities';
import { getStorybookFrameworkPath, runStorybookSetupCheck } from '../utils';
import { CLIOptions } from '@storybook/types'; // TODO(katerina): Remove when Storybook 7
import { CommonNxStorybookConfig } from '../../utils/models';

export default async function* storybookExecutor(
  options: CLIOptions & CommonNxStorybookConfig,
  context: ExecutorContext
): AsyncGenerator<{
  success: boolean;
  info?: { port: number; baseUrl?: string };
}> {
  const storybook7 = isStorybookV7();
  storybookConfigExistsCheck(options.configDir, context.projectName);
  if (storybook7) {
    const buildOptions: CLIOptions = options;
    const result: { port: number } = await runInstance(
      buildOptions,
      storybook7
    );
    yield {
      success: true,
      info: {
        port: result?.port,
        baseUrl: `${options.https ? 'https' : 'http'}://${
          options.host ?? 'localhost'
        }:${result?.port}`,
      },
    };
    await new Promise<{ success: boolean }>(() => {});
  } else {
    // TODO(katerina): Remove when Storybook 7
    // print warnings
    runStorybookSetupCheck(options);

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

function runInstance(options: CLIOptions, storybook7: boolean) {
  const env = process.env.NODE_ENV ?? 'development';
  process.env.NODE_ENV = env;

  if (storybook7) {
    return build['build']({
      ...options,
      mode: 'dev',
    } as any); // TODO(katerina): Change to actual types when Storybook 7
  } else {
    // TODO(katerina): Remove when Storybook 7
    return build.buildDev({
      ...options,
      configType: env.toUpperCase(),
      mode: 'dev',
    } as any);
  }
}
