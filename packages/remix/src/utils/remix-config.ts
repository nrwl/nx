import { joinPathFragments, readProjectConfiguration, Tree } from '@nx/devkit';
import type { AppConfig } from '@remix-run/dev';

export function getRemixConfigPath(tree: Tree, projectName: string) {
  const project = readProjectConfiguration(tree, projectName);
  if (!project) throw new Error(`Project does not exist: ${projectName}`);

  for (const ext of ['.cjs', '.js']) {
    const configPath = joinPathFragments(project.root, `remix.config${ext}`);
    if (tree.exists(configPath)) {
      return configPath;
    }
  }
}

export async function getRemixConfigValues(tree: Tree, projectName: string) {
  const remixConfigPath = getRemixConfigPath(tree, projectName);
  return eval(tree.read(remixConfigPath, 'utf-8')) as AppConfig;
}
