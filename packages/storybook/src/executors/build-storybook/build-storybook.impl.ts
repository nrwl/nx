import { ExecutorContext, logger } from '@nx/devkit';
import * as build from '@storybook/core-server';
import { CLIOptions } from '@storybook/types';
import 'dotenv/config';
import {
  pleaseUpgrade,
  storybookConfigExistsCheck,
  storybookMajorVersion,
} from '../../utils/utilities';
import { CommonNxStorybookConfig } from '../../utils/models';
import { getStorybookFrameworkPath, runStorybookSetupCheck } from '../utils';

export default async function buildStorybookExecutor(
  options: CLIOptions & CommonNxStorybookConfig,
  context: ExecutorContext
) {
  storybookConfigExistsCheck(options.configDir, context.projectName);
  const storybook7 = storybookMajorVersion() === 7;
  if (storybook7) {
    const buildOptions: CLIOptions = options;
    logger.info(`NX Storybook builder starting ...`);
    await runInstance(buildOptions, storybook7);
    logger.info(`NX Storybook builder finished ...`);
    logger.info(`NX Storybook files available in ${buildOptions.outputDir}`);
    return { success: true };
  } else {
    // TODO(katerina): Remove Nx17
    // print warnings
    runStorybookSetupCheck(options);
    logger.error(pleaseUpgrade());

    const frameworkPath = getStorybookFrameworkPath(options.uiFramework);
    const { default: frameworkOptions } = await import(frameworkPath);

    const buildOptions: CLIOptions = {
      ...options,
      ...frameworkOptions,
      frameworkPresets: [...(frameworkOptions.frameworkPresets || [])],
    };

    logger.info(`NX Storybook builder starting ...`);
    await runInstance(buildOptions, storybook7);
    logger.info(`NX Storybook builder finished ...`);
    logger.info(`NX Storybook files available in ${buildOptions.outputDir}`);
    return { success: true };
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
  const env = process.env.NODE_ENV ?? 'production';
  process.env.NODE_ENV = env;

  if (storybook7) {
    return build.build({
      ...options,
      mode: 'static',
    });
  } else {
    // TODO(katerina): Remove Nx17
    const nodeVersion = process.version.slice(1).split('.');
    if (+nodeVersion[0] === 18) {
      logger.warn(`
        If you are using the @storybook/builder-vite you may experience issues with Node 18.
        Please use Node 16 if you are using @storybook/builder-vite. 
      `);
    }
    return build.buildStaticStandalone({
      ...options,
      ci: true,
    } as any);
  }
}
