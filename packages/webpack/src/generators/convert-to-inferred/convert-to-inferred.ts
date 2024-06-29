import {
  addDependenciesToPackageJson,
  createProjectGraphAsync,
  formatFiles,
  runTasksInSerial,
  type ProjectConfiguration,
  type Tree,
} from '@nx/devkit';
import { AggregatedLog } from '@nx/devkit/src/generators/plugin-migrations/aggregate-log-util';
import { migrateProjectExecutorsToPlugin } from '@nx/devkit/src/generators/plugin-migrations/executor-to-plugin-migrator';
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

  const migratedProjects =
    await migrateProjectExecutorsToPlugin<WebpackPluginOptions>(
      tree,
      projectGraph,
      '@nx/webpack/plugin',
      createNodesV2,
      {
        buildTargetName: 'build',
        previewTargetName: 'preview',
        serveStaticTargetName: 'serve-static',
        serveTargetName: 'serve',
      },
      [
        {
          executors: ['@nx/webpack:webpack', '@nrwl/webpack:webpack'],
          postTargetTransformer:
            buildPostTargetTransformerFactory(migrationContext),
          targetPluginOptionMapper: (target) => ({ buildTargetName: target }),
          skipProjectFilter: skipProjectFilterFactory(tree),
        },
        {
          executors: ['@nx/webpack:dev-server', '@nrwl/webpack:dev-server'],
          postTargetTransformer:
            servePostTargetTransformerFactory(migrationContext),
          targetPluginOptionMapper: (target) => ({ serveTargetName: target }),
          skipProjectFilter: skipProjectFilterFactory(tree),
        },
      ],
      options.project
    );

  if (migratedProjects.size === 0) {
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
      return `The webpack config path is missing in the project configuration (${projectConfiguration.root}).`;
    }

    const sourceFile = tsquery.ast(tree.read(webpackConfigPath, 'utf-8'));

    const composePluginsSelector =
      'CallExpression:has(Identifier[name=composePlugins])';
    const composePlugins = tsquery<ts.CallExpression>(
      sourceFile,
      composePluginsSelector
    )[0];

    if (composePlugins) {
      return `The webpack config (${webpackConfigPath}) can only work with the  "@nx/webpack:webpack" executor. Run the "@nx/webpack:convert-config-to-webpack-plugin" generator first.`;
    }

    const nxAppWebpackPluginSelector =
      'PropertyAssignment:has(Identifier[name=plugins]) NewExpression:has(Identifier[name=NxAppWebpackPlugin])';
    const nxAppWebpackPlugin = tsquery<ts.NewExpression>(
      sourceFile,
      nxAppWebpackPluginSelector
    )[0];

    if (!nxAppWebpackPlugin) {
      return `No "NxAppWebpackPlugin" found in the webpack config (${webpackConfigPath}). Its usage is required for the migration to work.`;
    }

    return false;
  };
}
