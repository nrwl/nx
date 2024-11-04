import {
  ExecutorContext,
  joinPathFragments,
  logger,
  stripIndents,
} from '@nx/devkit';
import { VitestExecutorOptions } from '../schema';
import { normalizeViteConfigFilePath } from '../../../utils/options-utils';
import { relative } from 'path';
import {
  loadViteDynamicImport,
  loadVitestDynamicImport,
} from '../../../utils/executor-utils';

export async function getOptions(
  options: VitestExecutorOptions,
  context: ExecutorContext,
  projectRoot: string
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
      mode: options?.mode ?? 'production',
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

  const { parseCLI } = await loadVitestDynamicImport();

  const {
    options: { watch, ...normalizedExtraArgs },
  } = parseCLI(['vitest', ...getOptionsAsArgv(options)]);

  const settings = {
    // Explicitly set watch mode to false if not provided otherwise vitest
    // will enable watch mode by default for non CI environments
    watch: watch ?? false,
    ...normalizedExtraArgs,
    // This should not be needed as it's going to be set in vite.config.ts
    // but leaving it here in case someone did not migrate correctly
    root: resolved.config.root ?? root,
    config: viteConfigPath,
  };

  return mergeConfig(resolved?.config?.['test'] ?? {}, settings);
}

export function getOptionsAsArgv(obj: Record<string, any>): string[] {
  const argv: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    if (Array.isArray(value)) {
      value.forEach((item) => argv.push(`--${key}=${item}`));
    } else if (typeof value === 'object' && value !== null) {
      argv.push(`--${key}='${JSON.stringify(value)}'`);
    } else {
      argv.push(`--${key}=${value}`);
    }
  }

  return argv;
}
