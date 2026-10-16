import { getProjects, type ProjectConfiguration, type Tree } from '@nx/devkit';

const CONFIG_EXTENSIONS = ['js', 'cjs', 'mjs', 'ts', 'cts', 'mts'];
const REMOVED_HELPERS =
  /\b(composePlugins|composePluginsSync|withNx|withWeb|withReact)\b/;

export interface HelperUsage {
  name: string;
  root: string;
  configPaths: string[];
  usesExecutor: boolean;
}

export function inventoryComposePlugins(tree: Tree): HelperUsage[] {
  const usages: HelperUsage[] = [];

  for (const [name, project] of getProjects(tree)) {
    const configPaths = [...collectConfigPaths(tree, project)].filter((path) =>
      REMOVED_HELPERS.test(tree.read(path, 'utf-8') ?? '')
    );
    if (!configPaths.length) continue;

    usages.push({
      name,
      root: project.root,
      configPaths: configPaths.sort(),
      usesExecutor: Object.values(project.targets ?? {}).some(
        (target) => target.executor === '@nx/webpack:webpack'
      ),
    });
  }

  return usages;
}

function collectConfigPaths(
  tree: Tree,
  project: ProjectConfiguration
): Set<string> {
  const paths = new Set<string>();

  for (const target of Object.values(project.targets ?? {})) {
    for (const options of [
      target.options,
      ...Object.values(target.configurations ?? {}),
    ]) {
      const configured = options?.webpackConfig;
      // A package path such as `@nx/react/plugins/webpack` resolves to the stubs
      // rather than a workspace file; the prompt gives those projects a config.
      if (typeof configured === 'string' && tree.exists(configured)) {
        paths.add(configured);
      }
    }
  }

  for (const extension of CONFIG_EXTENSIONS) {
    const conventional = `${project.root}/webpack.config.${extension}`;
    if (tree.exists(conventional)) {
      paths.add(conventional);
    }
  }

  return paths;
}
