import {
  ExecutorContext,
  joinPathFragments,
  logger,
  parseTargetString,
  readTargetOptions,
} from '@nx/devkit';
import { existsSync } from 'fs';
import { InlineConfig, PreviewOptions, ServerOptions } from 'vite';
import { ViteDevServerExecutorOptions } from '../executors/dev-server/schema';
import { VitePreviewServerExecutorOptions } from '../executors/preview-server/schema';

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
  return existsSync(joinPathFragments(projectRoot, 'vite.config.ts'))
    ? joinPathFragments(projectRoot, 'vite.config.ts')
    : existsSync(joinPathFragments(projectRoot, 'vite.config.js'))
    ? joinPathFragments(projectRoot, 'vite.config.js')
    : undefined;
}

export function getProjectTsConfigPath(
  projectRoot: string
): string | undefined {
  return existsSync(joinPathFragments(projectRoot, 'tsconfig.app.json'))
    ? joinPathFragments(projectRoot, 'tsconfig.app.json')
    : existsSync(joinPathFragments(projectRoot, 'tsconfig.lib.json'))
    ? joinPathFragments(projectRoot, 'tsconfig.lib.json')
    : existsSync(joinPathFragments(projectRoot, 'tsconfig.json'))
    ? joinPathFragments(projectRoot, 'tsconfig.json')
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

export function getViteSharedConfig(
  options: Record<string, any>,
  context: ExecutorContext
): InlineConfig {
  const projectRoot =
    context.projectsConfigurations.projects[context.projectName].root;
  return {
    configFile: normalizeViteConfigFilePath(projectRoot, options.configFile),
  };
}

/**
 * Builds the options for the vite dev server.
 */
export async function getViteServerOptions(
  options: ViteDevServerExecutorOptions,
  context: ExecutorContext
): Promise<ServerOptions> {
  // Allows ESM to be required in CJS modules. Vite will be published as ESM in the future.
  const { searchForWorkspaceRoot } = await (Function(
    'return import("vite")'
  )() as Promise<typeof import('vite')>);
  const projectRoot =
    context.projectsConfigurations.projects[context.projectName].root;
  const serverOptions: ServerOptions = {
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
  const targetObj = parseTargetString(target, context);
  return readTargetOptions(targetObj, context);
}
