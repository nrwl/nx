import {
  ExecutorContext,
  joinPathFragments,
  logger,
  stripIndents,
} from '@nx/devkit';
import { VitestExecutorOptions } from '../schema';
import { normalizeViteConfigFilePath } from '../../../utils/options-utils';
import { relative } from 'path';
import { loadViteDynamicImport } from '../../../utils/executor-utils';

export async function getOptions(
  options: VitestExecutorOptions,
  context: ExecutorContext,
  projectRoot: string,
  extraArgs: Record<string, any>
) {
  // Allows ESM to be required in CJS modules. Vite will be published as ESM in the future.
  const { loadConfigFromFile, mergeConfig } = await loadViteDynamicImport();

  const viteConfigPath = normalizeViteConfigFilePath(
    context.root,
    projectRoot,
    options.configFile
  );

  if (!viteConfigPath) {
    throw new Error(
      stripIndents`
        Unable to load test config from config file ${viteConfigPath}.
        
        Please make sure that vitest is configured correctly, 
        or use the @nx/vite:vitest generator to configure it for you.
        You can read more here: https://nx.dev/nx-api/vite/generators/vitest
        `
    );
  }

  const resolved = await loadConfigFromFile(
    {
      mode: extraArgs?.mode ?? 'production',
      command: 'serve',
    },
    viteConfigPath
  );

  if (!viteConfigPath || !resolved?.config?.['test']) {
    logger.warn(stripIndents`Unable to load test config from config file ${
      resolved?.path ?? viteConfigPath
    }
  Some settings may not be applied as expected.
  You can manually set the config in the project, ${
    context.projectName
  }, configuration.
        `);
  }
  const root =
    projectRoot === '.'
      ? process.cwd()
      : relative(context.cwd, joinPathFragments(context.root, projectRoot));

  const settings = {
    ...extraArgs,
    // This should not be needed as it's going to be set in vite.config.ts
    // but leaving it here in case someone did not migrate correctly
    root: resolved.config.root ?? root,
    configFile: viteConfigPath,
  };

  return mergeConfig(resolved?.config?.['test'] ?? {}, settings);
}

export async function getExtraArgs(
  options: VitestExecutorOptions
): Promise<Record<string, any>> {
  // support passing extra args to vite cli
  const extraArgs: Record<string, any> = {};
  for (const key of Object.keys(options)) {
    extraArgs[key] = options[key];
  }

  return extraArgs;
}
