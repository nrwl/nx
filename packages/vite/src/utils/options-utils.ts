import {
  ExecutorContext,
  joinPathFragments,
  logger,
  parseTargetString,
  readTargetOptions,
} from '@nx/devkit';
import { existsSync } from 'fs';
import { relative, resolve } from 'path';
import {
  BuildOptions,
  InlineConfig,
  PluginOption,
  PreviewOptions,
  searchForWorkspaceRoot,
  ServerOptions,
} from 'vite';
import { ViteDevServerExecutorOptions } from '../executors/dev-server/schema';
import { VitePreviewServerExecutorOptions } from '../executors/preview-server/schema';
import replaceFiles from '../../plugins/rollup-replace-files.plugin';
import { ViteBuildExecutorOptions } from '../executors/build/schema';
import { registerTsConfigPaths } from '@nx/js/src/internal';
import {
  calculateProjectDependencies,
  createTmpTsConfig,
} from '@nx/js/src/utils/buildable-libs-utils';

/**
 * Returns the path to the vite config file or undefined when not found.
 */
export function normalizeViteConfigFilePath(
  projectRoot: string,
  configFile?: string
): string | undefined {
  if (configFile) {
    const normalized = joinPathFragments(configFile);
    if (!existsSync(normalized)) {
      throw new Error(
        `Could not find vite config at provided path "${normalized}".`
      );
    }
    return normalized;
  }
  return existsSync(joinPathFragments(`${projectRoot}/vite.config.ts`))
    ? joinPathFragments(`${projectRoot}/vite.config.ts`)
    : existsSync(joinPathFragments(`${projectRoot}/vite.config.js`))
    ? joinPathFragments(`${projectRoot}/vite.config.js`)
    : undefined;
}

/**
 * Returns the path to the proxy configuration file or undefined when not found.
 */
export function getViteServerProxyConfigPath(
  nxProxyConfig: string | undefined,
  context: ExecutorContext
): string | undefined {
  if (nxProxyConfig) {
    const projectRoot =
      context.projectsConfigurations.projects[context.projectName].root;

    const proxyConfigPath = nxProxyConfig
      ? joinPathFragments(context.root, nxProxyConfig)
      : joinPathFragments(projectRoot, 'proxy.conf.json');

    if (existsSync(proxyConfigPath)) {
      return proxyConfigPath;
    }
  }
}

/**
 * Builds the shared options for vite.
 *
 * Most shared options are derived from the build target.
 */
export function getViteSharedConfig(
  options: ViteBuildExecutorOptions,
  clearScreen: boolean | undefined,
  context: ExecutorContext
): InlineConfig {
  const projectRoot =
    context.projectsConfigurations.projects[context.projectName].root;

  const root = relative(
    context.cwd,
    joinPathFragments(context.root, projectRoot)
  );

  return {
    mode: options.mode,
    root,
    base: options.base,
    configFile: normalizeViteConfigFilePath(projectRoot, options.configFile),
    plugins: [replaceFiles(options.fileReplacements) as PluginOption],
    optimizeDeps: { force: options.force },
    clearScreen: clearScreen,
    logLevel: options.logLevel,
  };
}

/**
 * Builds the options for the vite dev server.
 */
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
    fs: {
      allow: [
        searchForWorkspaceRoot(joinPathFragments(projectRoot)),
        joinPathFragments(context.root, 'node_modules/vite'),
      ],
    },
  };

  const proxyConfigPath = getViteServerProxyConfigPath(
    options.proxyConfig,
    context
  );
  if (proxyConfigPath) {
    logger.info(`Loading proxy configuration from: ${proxyConfigPath}`);
    serverOptions.proxy = require(proxyConfigPath);
  }

  return serverOptions;
}

/**
 * Builds the build options for the vite.
 */
export function getViteBuildOptions(
  options: ViteBuildExecutorOptions,
  context: ExecutorContext
): BuildOptions {
  const projectRoot =
    context.projectsConfigurations.projects[context.projectName].root;

  return {
    outDir: relative(projectRoot, options.outputPath),
    emptyOutDir: options.emptyOutDir,
    reportCompressedSize: true,
    cssCodeSplit: options.cssCodeSplit,
    target: options.target ?? 'esnext',
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    sourcemap: options.sourcemap,
    minify: options.minify,
    manifest: options.manifest,
    ssrManifest: options.ssrManifest,
    ssr: options.ssr,
    watch: options.watch as BuildOptions['watch'],
  };
}

/**
 * Builds the options for the vite preview server.
 */
export function getVitePreviewOptions(
  options: VitePreviewServerExecutorOptions,
  context: ExecutorContext
): PreviewOptions {
  const serverOptions: ServerOptions = {
    host: options.host,
    port: options.port,
    https: options.https,
    open: options.open,
  };

  const proxyConfigPath = getViteServerProxyConfigPath(
    options.proxyConfig,
    context
  );
  if (proxyConfigPath) {
    logger.info(`Loading proxy configuration from: ${proxyConfigPath}`);
    serverOptions.proxy = require(proxyConfigPath);
  }

  return serverOptions;
}

export function getNxTargetOptions(target: string, context: ExecutorContext) {
  const targetObj = parseTargetString(target, context.projectGraph);
  return readTargetOptions(targetObj, context);
}

export function registerPaths(
  projectRoot: string,
  options: ViteBuildExecutorOptions | ViteDevServerExecutorOptions,
  context: ExecutorContext
) {
  const tsConfig = resolve(projectRoot, 'tsconfig.json');
  options.buildLibsFromSource ??= true;

  if (!options.buildLibsFromSource) {
    const { dependencies } = calculateProjectDependencies(
      context.projectGraph,
      context.root,
      context.projectName,
      context.targetName,
      context.configurationName
    );
    const tmpTsConfig = createTmpTsConfig(
      tsConfig,
      context.root,
      projectRoot,
      dependencies
    );

    registerTsConfigPaths(tmpTsConfig);
  } else {
    registerTsConfigPaths(tsConfig);
  }
}
