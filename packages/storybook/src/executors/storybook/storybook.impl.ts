import { ExecutorContext } from '@nrwl/devkit';
import { buildDev } from '@storybook/core-server';
import 'dotenv/config';
import { CommonNxStorybookConfig } from '../models';
import {
  getStorybookFrameworkPath,
  resolveCommonStorybookOptionMapper,
  runStorybookSetupCheck,
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

  const option = storybookOptionMapper(options, frameworkOptions, context);

  // print warnings
  runStorybookSetupCheck(options);

  await runInstance(option);

  yield { success: true };

  // This Promise intentionally never resolves, leaving the process running
  await new Promise<{ success: boolean }>(() => {});
}

function runInstance(options: StorybookExecutorOptions) {
  const env = process.env.NODE_ENV ?? 'development';
  process.env.NODE_ENV = env;
  const originalConsoleLog = console.log;
  console.log = function (...args) {
    const localhostString = 'http://localhost:';
    if (args[0].includes(localhostString)) {
      const indexOfLocalHost = args[0].indexOf(localhostString);
      console.info(
        args[0].slice(
          indexOfLocalHost + localhostString.length,
          indexOfLocalHost + localhostString.length + 4
        ),
        indexOfLocalHost
      );
      process.env.NXPORT = args[0].slice(
        indexOfLocalHost + localhostString.length,
        indexOfLocalHost + localhostString.length + 4
      );
    }
    originalConsoleLog.apply(console, args);
  };
  return buildDev({
    ...options,
    configType: env.toUpperCase(),
  } as any);
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
