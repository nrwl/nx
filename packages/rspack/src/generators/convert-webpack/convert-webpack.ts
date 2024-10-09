import {
  addDependenciesToPackageJson,
  formatFiles,
  getProjects,
  type Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { Schema } from './schema';
import {
  rspackCoreVersion,
  rspackDevServerVersion,
} from '../../utils/versions';
import { transformEsmConfigFile } from './lib/transform-esm';
import { transformCjsConfigFile } from './lib/transform-cjs';

export default async function (tree: Tree, options: Schema) {
  const projects = getProjects(tree);
  if (!projects.has(options.project)) {
    throw new Error(
      `Could not find project '${options.project}'. Ensure you have specified the project you'd like to convert correctly.`
    );
  }
  const project = projects.get(options.project);

  const webpackConfigsToConvert: [string, string][] = [];

  for (const [targetName, target] of Object.entries(project.targets)) {
    if (
      target.executor === '@nx/webpack:webpack' ||
      target.executor === '@nrwl/webpack:webpack'
    ) {
      target.executor = '@nx/rspack:rspack';
      if (!target.options.target) {
        target.options.target = 'web';
      }
      const convertWebpackConfigOption = (options: Record<string, any>) => {
        if (!options.webpackConfig) {
          return;
        }
        const rspackConfigPath = options.webpackConfig.replace(
          /webpack(?!.*webpack)/,
          'rspack'
        );
        webpackConfigsToConvert.push([options.webpackConfig, rspackConfigPath]);

        options.rspackConfig = rspackConfigPath;
        delete options.webpackConfig;
      };

      if (target.options.webpackConfig) {
        convertWebpackConfigOption(target.options);
      }

      if (target.configurations) {
        for (const [configurationName, configuration] of Object.entries(
          target.configurations
        )) {
          convertWebpackConfigOption(configuration);
        }
      }
    } else if (
      target.executor === '@nx/webpack:dev-server' ||
      target.executor === '@nrwl/webpack:dev-server'
    ) {
      target.executor = '@nx/rspack:dev-server';
    } else if (
      target.executor === '@nx/webpack:ssr-dev-server' ||
      target.executor === '@nrwl/webpack:ssr-dev-server'
    ) {
      target.executor = '@nx/rspack:dev-server';
    } else if (
      target.executor === '@nx/react:module-federation-dev-server' ||
      target.executor === '@nrwl/react:module-federation-dev-server'
    ) {
      target.executor = '@nx/rspack:module-federation-dev-server';
    } else if (
      target.executor === '@nx/react:module-federation-ssr-dev-server' ||
      target.executor === '@nrwl/react:module-federation-ssr-dev-server'
    ) {
      target.executor = '@nx/rspack:module-federation-ssr-dev-server';
    } else if (
      target.executor === '@nx/react:module-federation-static-server' ||
      target.executor === '@nrwl/react:module-federation-static-server'
    ) {
      target.executor = '@nx/rspack:module-federation-static-server';
    }
  }

  for (const [webpackConfigPath, rspackConfigPath] of webpackConfigsToConvert) {
    tree.rename(webpackConfigPath, rspackConfigPath);
    transformConfigFile(tree, rspackConfigPath);
  }

  updateProjectConfiguration(tree, options.project, project);
  const installTask = addDependenciesToPackageJson(
    tree,
    {},
    {
      '@rspack/core': rspackCoreVersion,
      '@rspack/dev-server': rspackDevServerVersion,
    }
  );

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return installTask;
}

function transformConfigFile(tree: Tree, configPath: string) {
  transformEsmConfigFile(tree, configPath);
  transformCjsConfigFile(tree, configPath);
  cleanupEmptyImports(tree, configPath);
  replaceOfRequireOfLocalWebpackConfig(tree, configPath);
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
