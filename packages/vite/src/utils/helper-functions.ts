import {
  ExecutorContext,
  joinPathFragments,
  logger,
  parseTargetString,
  readTargetOptions,
} from '@nrwl/devkit';
import { existsSync } from 'fs';
import { join, relative } from 'path';
import {
  BuildOptions,
  defineConfig,
  InlineConfig,
  mergeConfig,
  searchForWorkspaceRoot,
  ServerOptions,
  UserConfig,
  UserConfigFn,
} from 'vite';
import { ViteDevServerExecutorOptions } from '../executors/dev-server/schema';
import replaceFiles from '../../plugins/rollup-replace-files.plugin';
import { ViteBuildExecutorOptions } from '../executors/build/schema';

export async function getBuildConfig(
  options:
    | (ViteDevServerExecutorOptions & ViteBuildExecutorOptions)
    | ViteBuildExecutorOptions,
  context: ExecutorContext
): Promise<InlineConfig> {
  const projectRoot = context.workspace.projects[context.projectName].root;

  const userConfig: UserConfig = await getUserConfig(
    options as ViteDevServerExecutorOptions & ViteBuildExecutorOptions,
    context,
    projectRoot
  );

  return mergeConfig(userConfig, {
    configFile: normalizeConfigFilePath(
      options.configFile,
      context.root,
      projectRoot
    ),
    build: getViteBuildOptions(
      options as ViteDevServerExecutorOptions & ViteBuildExecutorOptions,
      projectRoot
    ),
  } as InlineConfig);
}

export function normalizeConfigFilePath(
  configFile: string,
  workspaceRoot: string,
  projectRoot: string
): string {
  return configFile
    ? joinPathFragments(`${workspaceRoot}/${configFile}`)
    : existsSync(joinPathFragments(`${projectRoot}/vite.config.ts`))
    ? joinPathFragments(`${projectRoot}/vite.config.ts`)
    : existsSync(joinPathFragments(`${projectRoot}/vite.config.js`))
    ? joinPathFragments(`${projectRoot}/vite.config.js`)
    : undefined;
}

export function normalizeTsConfigPath(
  tsConfig: string,
  workspaceRoot: string
): string {
  return tsConfig
    ? joinPathFragments(`${workspaceRoot}/${tsConfig}`)
    : undefined;
}

export async function getUserConfig(
  options: ViteDevServerExecutorOptions & ViteBuildExecutorOptions,
  context: ExecutorContext,
  projectRoot: string
): Promise<UserConfig> {
  const baseUserConfig: UserConfigFn = (await defineConfig(() => {
    return {
      base: options.baseHref ?? '/',
      root: projectRoot,
      tsConfig: normalizeTsConfigPath(options.tsConfig, context.root),
    };
  })) as UserConfigFn;
  return baseUserConfig({
    command: 'build',
    mode: options['configurationName'],
  });
}

export function getServerOptions(
  options: ViteDevServerExecutorOptions,
  context: ExecutorContext
): ServerOptions {
  const projectRoot = context.workspace.projects[context.projectName].root;
  let serverOptions: ServerOptions = {};
  if (options.proxyConfig) {
    const proxyConfigPath = options.proxyConfig
      ? join(context.root, options.proxyConfig)
      : join(projectRoot, 'proxy.conf.json');

    if (existsSync(proxyConfigPath)) {
      logger.info(`Loading proxy configuration from: ${proxyConfigPath}`);
      serverOptions.proxy = require(proxyConfigPath);
      serverOptions.fs = {
        allow: [
          searchForWorkspaceRoot(joinPathFragments(projectRoot)),
          joinPathFragments(context.root, 'node_modules/vite'),
        ],
      };
    }
  }

  serverOptions = {
    ...serverOptions,
    host: options.host,
    port: options.port,
    https: options.https,
    hmr: options.hmr,
  };

  return serverOptions;
}

export function getBuildTargetOptions(
  options: ViteDevServerExecutorOptions,
  context: ExecutorContext
) {
  const target = parseTargetString(options.buildTarget);
  return readTargetOptions(target, context);
}

export function getViteBuildOptions(
  options: ViteDevServerExecutorOptions & ViteBuildExecutorOptions,
  projectRoot: string
): BuildOptions {
  let buildOptions: BuildOptions = {
    outDir: relative(projectRoot, options.outputPath),
    emptyOutDir: true,
    reportCompressedSize: true,
    cssCodeSplit: true,
    target: 'esnext',
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    rollupOptions: {
      plugins: [replaceFiles(options.fileReplacements)],
    },
  };

  buildOptions = {
    ...buildOptions,
    sourcemap: options.sourcemap,
  };

  return buildOptions;
}
