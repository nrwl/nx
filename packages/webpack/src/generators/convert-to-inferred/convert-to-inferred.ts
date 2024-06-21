import {
  addDependenciesToPackageJson,
  createProjectGraphAsync,
  formatFiles,
  runTasksInSerial,
  type ProjectConfiguration,
  type Tree,
} from '@nx/devkit';
import { AggregatedLog } from '@nx/devkit/src/generators/plugin-migrations/aggregate-log-util';
import { migrateExecutorToPlugin } from '@nx/devkit/src/generators/plugin-migrations/executor-to-plugin-migrator';
import { tsquery } from '@phenomnomnominal/tsquery';
import * as ts from 'typescript';
import { createNodesV2, type WebpackPluginOptions } from '../../plugins/plugin';
import { webpackCliVersion } from '../../utils/versions';
import {
  buildPostTargetTransformerFactory,
  servePostTargetTransformerFactory,
  type MigrationContext,
} from './utils';

interface Schema {
  project?: string;
  skipFormat?: boolean;
}

export async function convertToInferred(tree: Tree, options: Schema) {
  const projectGraph = await createProjectGraphAsync();
  const migrationContext: MigrationContext = {
    logger: new AggregatedLog(),
    projectGraph,
    workspaceRoot: tree.root,
  };

  // build
  const migratedBuildProjects =
    await migrateExecutorToPlugin<WebpackPluginOptions>(
      tree,
      projectGraph,
      '@nx/webpack:webpack',
      '@nx/webpack/plugin',
      (targetName) => ({
        buildTargetName: targetName,
        previewTargetName: 'preview',
        serveStaticTargetName: 'serve-static',
        serveTargetName: 'serve',
      }),
      buildPostTargetTransformerFactory(migrationContext),
      createNodesV2,
      options.project,
      { skipProjectFilter: skipProjectFilterFactory(tree) }
    );
  const migratedBuildProjectsLegacy =
    await migrateExecutorToPlugin<WebpackPluginOptions>(
      tree,
      projectGraph,
      '@nrwl/webpack:webpack',
      '@nx/webpack/plugin',
      (targetName) => ({
        buildTargetName: targetName,
        previewTargetName: 'preview',
        serveStaticTargetName: 'serve-static',
        serveTargetName: 'serve',
      }),
      buildPostTargetTransformerFactory(migrationContext),
      createNodesV2,
      options.project,
      { skipProjectFilter: skipProjectFilterFactory(tree) }
    );

  // serve
  const migratedServeProjects =
    await migrateExecutorToPlugin<WebpackPluginOptions>(
      tree,
      projectGraph,
      '@nx/webpack:dev-server',
      '@nx/webpack/plugin',
      (targetName) => ({
        buildTargetName: 'build',
        previewTargetName: 'preview',
        serveStaticTargetName: 'serve-static',
        serveTargetName: targetName,
      }),
      servePostTargetTransformerFactory(migrationContext),
      createNodesV2,
      options.project,
      { skipProjectFilter: skipProjectFilterFactory(tree) }
    );
  const migratedServeProjectsLegacy =
    await migrateExecutorToPlugin<WebpackPluginOptions>(
      tree,
      projectGraph,
      '@nrwl/webpack:dev-server',
      '@nx/webpack/plugin',
      (targetName) => ({
        buildTargetName: 'build',
        previewTargetName: 'preview',
        serveStaticTargetName: 'serve-static',
        serveTargetName: targetName,
      }),
      servePostTargetTransformerFactory(migrationContext),
      createNodesV2,
      options.project,
      { skipProjectFilter: skipProjectFilterFactory(tree) }
    );

  const migratedProjects =
    migratedBuildProjects.size +
    migratedBuildProjectsLegacy.size +
    migratedServeProjects.size +
    migratedServeProjectsLegacy.size;

  if (migratedProjects === 0) {
    throw new Error('Could not find any targets to migrate.');
  }

  const installCallback = addDependenciesToPackageJson(
    tree,
    {},
    { 'webpack-cli': webpackCliVersion },
    undefined,
    true
  );

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(installCallback, () => {
    migrationContext.logger.flushLogs();
  });
}

function skipProjectFilterFactory(tree: Tree) {
  return function skipProjectFilter(
    projectConfiguration: ProjectConfiguration
  ): false | string {
    const buildTarget = Object.values(projectConfiguration.targets).find(
      (target) =>
        target.executor === '@nx/webpack:webpack' ||
        target.executor === '@nrwl/webpack:webpack'
    );
    // the projects for which this is called are guaranteed to have a build target
    const webpackConfigPath = buildTarget.options.webpackConfig;
    if (!webpackConfigPath) {
      return 'The webpack config path is missing in the project configuration.';
    }

    const sourceFile = tsquery.ast(tree.read(webpackConfigPath, 'utf-8'));

    const composePluginsSelector =
      'CallExpression:has(Identifier[name=composePlugins])';
    const composePlugins = tsquery<ts.CallExpression>(
      sourceFile,
      composePluginsSelector
    )[0];

    if (composePlugins) {
      return 'The webpack config is still configured to solely work with the "@nx/webpack:webpack" executor. You must run the "@nx/webpack:convert-config-to-webpack" generator first.';
    }

    const nxAppWebpackPluginSelector =
      'PropertyAssignment:has(Identifier[name=plugins]) NewExpression:has(Identifier[name=NxAppWebpackPlugin])';
    const nxAppWebpackPlugin = tsquery<ts.NewExpression>(
      sourceFile,
      nxAppWebpackPluginSelector
    )[0];

    if (!nxAppWebpackPlugin) {
      return 'No "NxAppWebpackPlugin" found in the webpack config. Its usage is required for the migration to work.';
    }

    return false;
  };
}
