import {
  joinPathFragments,
  readProjectConfiguration,
  Tree,
  workspaceRoot,
} from '@nx/devkit';
import type { AppConfig } from '@remix-run/dev';
import { createContext, SourceTextModule } from 'vm';

export function getRemixConfigPath(tree: Tree, projectName: string) {
  const project = readProjectConfiguration(tree, projectName);
  if (!project) throw new Error(`Project does not exist: ${projectName}`);

  for (const ext of ['.mjs', '.cjs', '.js']) {
    const configPath = joinPathFragments(project.root, `remix.config${ext}`);
    if (tree.exists(configPath)) {
      return configPath;
    }
  }
}

export function getRemixConfigPathFromProjectRoot(
  tree: Tree,
  projectRoot: string
) {
  let pathToRemixConfig: string;
  for (const ext of ['.js', '.mjs', '.cjs']) {
    pathToRemixConfig = joinPathFragments(projectRoot, `remix.config${ext}`);
    if (tree.exists(pathToRemixConfig)) {
      return pathToRemixConfig;
    }
  }

  throw new Error(
    `Could not find a Remix Config File. Please ensure a "remix.config.js" file exists at the root of your project.`
  );
}

const _remixConfigCache: Record<string, AppConfig> = {};

export async function getRemixConfigValues(tree: Tree, projectName: string) {
  const remixConfigPath = joinPathFragments(
    workspaceRoot,
    getRemixConfigPath(tree, projectName)
  );
  const cacheKey = `${projectName}/${remixConfigPath}`;
  let appConfig = _remixConfigCache[cacheKey];

  if (!appConfig) {
    try {
      const importedConfig = await Function(
        `return import("${remixConfigPath}?t=${Date.now()}")`
      )();
      appConfig = (importedConfig?.default || importedConfig) as AppConfig;
    } catch {
      appConfig = require(remixConfigPath);
    }
    _remixConfigCache[cacheKey] = appConfig;
  }

  return appConfig;
}
