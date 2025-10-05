import {
  joinPathFragments,
  readProjectConfiguration,
  Tree,
  workspaceRoot,
} from '@nx/devkit';
import type { AppConfig } from '@remix-run/dev';
import { loadViteDynamicImport } from './executor-utils';

export function getRemixConfigPathDetails(tree: Tree, projectName: string) {
  const project = readProjectConfiguration(tree, projectName);
  if (!project) throw new Error(`Project does not exist: ${projectName}`);

  for (const ext of ['.mjs', '.cjs', '.js', '.mts', '.cts', '.ts']) {
    const configPath = joinPathFragments(project.root, `vite.config${ext}`);
    if (tree.exists(configPath)) {
      return [configPath, 'vite'];
    }
  }

  for (const ext of ['.mjs', '.cjs', '.js']) {
    const configPath = joinPathFragments(project.root, `remix.config${ext}`);
    if (tree.exists(configPath)) {
      return [configPath, 'classic'];
    }
  }
}

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
  const [configPath, configType] = getRemixConfigPathDetails(tree, projectName);
  const remixConfigPath = joinPathFragments(workspaceRoot, configPath);
  const cacheKey = `${projectName}/${remixConfigPath}`;
  let appConfig = _remixConfigCache[cacheKey];

  let resolvedConfig: any;
  if (!appConfig) {
    if (configType === 'vite') {
      const { resolveConfig } = await loadViteDynamicImport();
      const viteBuildConfig = (await resolveConfig(
        {
          configFile: configPath,
          mode: 'development',
        },
        'build'
      )) as any;
      appConfig = viteBuildConfig.__remixPluginContext?.remixConfig;
    } else {
      try {
        const importedConfig = await Function(
          `return import("${remixConfigPath}?t=${Date.now()}")`
        )();
        appConfig = (importedConfig?.default || importedConfig) as AppConfig;
      } catch {
        appConfig = require(remixConfigPath);
      }
    }
    _remixConfigCache[cacheKey] = appConfig;
  }

  return appConfig;
}
