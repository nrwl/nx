import { getProjects, type ProjectConfiguration, type Tree } from '@nx/devkit';

const CONFIG_EXTENSIONS = ['js', 'cjs', 'mjs', 'ts', 'cts', 'mts'];
const REMOVED_HELPERS =
  /\b(composePlugins|composePluginsSync|withNx|withWeb|withReact)\b/;
// Left by an earlier conversion; the wrapped `.old` config still calls the helpers.
const LEGACY_WRAPPER = /\buseLegacyNxPlugin\b/;
const MODULE_FEDERATION_HELPERS = /\bwithModuleFederation(ForSSR)?\b/;

export interface HelperUsage {
  name: string;
  root: string;
  configPaths: string[];
  usesHelpers: boolean;
  usesModuleFederation: boolean;
  usesExecutor: boolean;
}

export function inventoryComposePlugins(tree: Tree): HelperUsage[] {
  const usages: HelperUsage[] = [];

  for (const [name, project] of getProjects(tree)) {
    const configs = [...collectConfigPaths(tree, project)].map((path) => ({
      path,
      source: tree.read(path, 'utf-8') ?? '',
    }));
    const configPaths = configs
      .filter(
        ({ source }) =>
          REMOVED_HELPERS.test(source) || LEGACY_WRAPPER.test(source)
      )
      .map(({ path }) => path);
    if (!configPaths.length) continue;

    usages.push({
      name,
      root: project.root,
      configPaths: configPaths.sort(),
      usesHelpers: configs.some(({ source }) => REMOVED_HELPERS.test(source)),
      usesModuleFederation: configs.some(({ source }) =>
        MODULE_FEDERATION_HELPERS.test(source)
      ),
      usesExecutor: Object.values(project.targets ?? {}).some((target) =>
        ['@nx/rspack:rspack', '@nrwl/rspack:rspack'].includes(target.executor)
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
      const configured = options?.rspackConfig;
      // A package path such as `@nx/react/plugins/webpack` resolves to the stubs
      // rather than a workspace file; the prompt gives those projects a config.
      if (typeof configured === 'string' && tree.exists(configured)) {
        paths.add(configured);
      }
    }
  }

  for (const extension of CONFIG_EXTENSIONS) {
    const conventional = `${project.root}/rspack.config.${extension}`;
    if (tree.exists(conventional)) {
      paths.add(conventional);
    }
  }

  return paths;
}
