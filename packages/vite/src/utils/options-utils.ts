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
  InlineConfig,
  PluginOption,
  searchForWorkspaceRoot,
  ServerOptions,
} from 'vite';
import { ViteDevServerExecutorOptions } from '../executors/dev-server/schema';
import replaceFiles from '../../plugins/rollup-replace-files.plugin';
import { ViteBuildExecutorOptions } from '../executors/build/schema';

export function getViteSharedConfig(
  options: ViteBuildExecutorOptions,
  clearScreen: boolean | undefined,
  context: ExecutorContext
): InlineConfig {
  const projectRoot =
    context.projectsConfigurations.projects[context.projectName].root;

  return {
    mode: options.mode,
    root: projectRoot,
    base: options.base,
    configFile: normalizeViteConfigFilePath(projectRoot, options.configFile),
    plugins: [replaceFiles(options.fileReplacements) as PluginOption],
    optimizeDeps: { force: options.force },
    clearScreen: clearScreen,
    logLevel: options.logLevel,
  };
}

export function normalizeViteConfigFilePath(
  projectRoot: string,
  configFile?: string
): string {
  return configFile && existsSync(joinPathFragments(configFile))
    ? configFile
    : existsSync(joinPathFragments(`${projectRoot}/vite.config.ts`))
    ? joinPathFragments(`${projectRoot}/vite.config.ts`)
    : existsSync(joinPathFragments(`${projectRoot}/vite.config.js`))
    ? joinPathFragments(`${projectRoot}/vite.config.js`)
    : undefined;
}

export function getViteServerOptions(
  options: ViteDevServerExecutorOptions,
  context: ExecutorContext
): ServerOptions {
  const projectRoot =
    context.projectsConfigurations.projects[context.projectName].root;
  const serverOptions: ServerOptions = {
    host: options.host,
    port: options.port,
    https: options.https,
    hmr: options.hmr,
    open: options.open,
    cors: options.cors,
  };

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

  return serverOptions;
}

export function getNxTargetOptions(target: string, context: ExecutorContext) {
  const targetObj = parseTargetString(target, context.projectGraph);
  return readTargetOptions(targetObj, context);
}

export function getViteBuildOptions(
  options: ViteBuildExecutorOptions,
  context: ExecutorContext
): BuildOptions {
  const projectRoot =
    context.projectsConfigurations.projects[context.projectName].root;

  return {
    outDir: relative(projectRoot, options.outputPath),
    emptyOutDir: true,
    reportCompressedSize: true,
    cssCodeSplit: true,
    target: 'esnext',
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    sourcemap: options.sourcemap,
    minify: options.minify,
    manifest: options.manifest,
    ssrManifest: options.ssrManifest,
    ssr: options.ssr,
  };
}
