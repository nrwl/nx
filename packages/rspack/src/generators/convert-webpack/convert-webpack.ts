import {
  addDependenciesToPackageJson,
  formatFiles,
  getProjects,
  joinPathFragments,
  readNxJson,
  type Tree,
  updateNxJson,
  updateProjectConfiguration,
} from '@nx/devkit';
import { Schema } from './schema';
import {
  rspackCoreVersion,
  rspackDevServerVersion,
  rspackPluginReactRefreshVersion,
} from '../../utils/versions';
import { transformPluginConfig } from './lib/transform-plugin-config';
import { assertSupportedRspackVersion } from '../../utils/assert-supported-rspack-version';

export default async function (tree: Tree, options: Schema) {
  assertSupportedRspackVersion(tree);

  const projects = getProjects(tree);
  if (!projects.has(options.project)) {
    throw new Error(
      `Could not find project '${options.project}'. Ensure you have specified the project you'd like to convert correctly.`
    );
  }
  const project = projects.get(options.project);

  if (
    Object.values(project.targets ?? {}).some((target) =>
      [
        '@nx/webpack:webpack',
        '@nx/webpack:dev-server',
        '@nx/webpack:ssr-dev-server',
      ].includes(target.executor)
    )
  ) {
    throw new Error(
      'Migrate this project to @nx/webpack/plugin before converting it to Rspack.'
    );
  }
  const webpackConfigsWithPluginsToConvert: [string, string][] = [];

  for (const target of Object.values(project.targets ?? {})) {
    if (
      (target.executor === 'nx:run-commands' && target.options.command) ||
      target.command === 'webpack-cli build'
    ) {
      if (target.options?.command) {
        target.options.command = 'rspack build';
      } else if (target.command) {
        target.command = 'rspack build';
      }

      const webpackConfigPath = findWebpackConfigPath(tree, project.root);
      if (webpackConfigPath) {
        webpackConfigsWithPluginsToConvert.push([
          webpackConfigPath,
          webpackConfigPath.replace(/webpack(?!.*webpack)/, 'rspack'),
        ]);
      }
    } else if (target.executor === '@nx/react:module-federation-dev-server') {
      target.executor = '@nx/rspack:module-federation-dev-server';
    } else if (
      target.executor === '@nx/react:module-federation-ssr-dev-server'
    ) {
      target.executor = '@nx/rspack:module-federation-ssr-dev-server';
    } else if (
      target.executor === '@nx/react:module-federation-static-server'
    ) {
      target.executor = '@nx/rspack:module-federation-static-server';
    }
  }

  if (webpackConfigsWithPluginsToConvert.length === 0) {
    // Projects built by the inferred @nx/webpack/plugin target have no
    // explicit webpack target to match, only a config file.
    const webpackConfigPath = findWebpackConfigPath(tree, project.root);
    if (webpackConfigPath) {
      webpackConfigsWithPluginsToConvert.push([
        webpackConfigPath,
        webpackConfigPath.replace(/webpack(?!.*webpack)/, 'rspack'),
      ]);
    }
  }

  if (webpackConfigsWithPluginsToConvert.length === 0) {
    console.error(
      `Project '${options.project}' does not have any webpack targets to convert.`
    );
    return;
  }

  for (const [
    webpackConfigPath,
    rspackConfigPath,
  ] of webpackConfigsWithPluginsToConvert) {
    tree.rename(webpackConfigPath, rspackConfigPath);
    transformConfigFileWithPlugins(tree, rspackConfigPath);
  }

  updateProjectConfiguration(tree, options.project, project);
  const nxJson = readNxJson(tree);
  if (nxJson.plugins !== undefined && nxJson.plugins.length > 0) {
    const nonRspackPlugins = nxJson.plugins.filter(
      (plugin) =>
        (typeof plugin !== 'string' && plugin.plugin !== '@nx/rspack/plugin') ||
        (typeof plugin === 'string' && plugin !== '@nx/rspack/plugin')
    );
    let rspackPlugins = nxJson.plugins.filter(
      (plugin) =>
        (typeof plugin !== 'string' && plugin.plugin === '@nx/rspack/plugin') ||
        (typeof plugin === 'string' && plugin === '@nx/rspack/plugin')
    );

    if (rspackPlugins.length === 0) {
      rspackPlugins = rspackPlugins.map((plugin) => {
        if (typeof plugin === 'string') {
          return {
            plugin: plugin,
            exclude: [`${project.root}/*`],
          };
        }

        return {
          ...plugin,
          exclude: [...(plugin.exclude ?? []), `${project.root}/*`],
        };
      });
      nxJson.plugins = [...nonRspackPlugins, ...rspackPlugins];
      updateNxJson(tree, nxJson);
    }
  }
  const installTask = addDependenciesToPackageJson(
    tree,
    {},
    {
      '@rspack/core': rspackCoreVersion,
      '@rspack/dev-server': rspackDevServerVersion,
      // @rspack/plugin-react-refresh is required at runtime by
      // apply-react-config when building a React project. Since it is an
      // optional peer dependency of @nx/rspack, the convert generator must
      // install it explicitly.
      '@rspack/plugin-react-refresh': rspackPluginReactRefreshVersion,
    },
    undefined,
    true
  );

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return installTask;
}

function transformConfigFileWithPlugins(tree: Tree, configPath: string) {
  transformPluginConfig(tree, configPath);
}

function replaceOfRequireOfLocalWebpackConfig(tree: Tree, configPath: string) {
  const requireOfLocalWebpackConfig =
    /(?<=require\s*\(\s*['"][^'"]*)(webpack)(?!.*webpack)(?=[^'"]*['"]\s*\))/g;
  const configContents = tree.read(configPath, 'utf-8');
  const newContents = configContents.replace(
    requireOfLocalWebpackConfig,
    'rspack'
  );
  tree.write(configPath, newContents);
}

function cleanupEmptyImports(tree: Tree, configPath: string) {
  const emptyImportRegex = /import\s*\{\s*\}\s*from\s*['"][^'"]+['"];/g;
  const emptyConstRequires =
    /(const|let)\s*\{\s*\}\s*=\s*require\s*\(\s*['"][^'"]+['"]\s*\);/g;
  const configContents = tree.read(configPath, 'utf-8');
  let newContents = configContents.replace(emptyImportRegex, '');
  newContents = newContents.replace(emptyConstRequires, '');
  tree.write(configPath, newContents);
}

function findWebpackConfigPath(tree: Tree, projectRoot: string) {
  const possibleConfigPaths = [
    'webpack.config.js',
    'webpack.config.mjs',
    'webpack.config.cjs',
    'webpack.config.ts',
    'webpack.config.mts',
    'webpack.config.cts',
  ];
  for (const configPath of possibleConfigPaths) {
    const possiblePath = joinPathFragments(projectRoot, configPath);
    if (tree.exists(possiblePath)) {
      return possiblePath;
    }
  }
}
