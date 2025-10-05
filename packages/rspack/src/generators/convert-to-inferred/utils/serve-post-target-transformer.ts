import {
  parseTargetString,
  readJson,
  readTargetOptions,
  type ExecutorContext,
  type ProjectsConfigurations,
  type TargetConfiguration,
  type Tree,
} from '@nx/devkit';
import {
  processTargetOutputs,
  toProjectRelativePath,
} from '@nx/devkit/src/generators/plugin-migrations/plugin-migration-utils';
import { tsquery } from '@phenomnomnominal/tsquery';
import { basename, resolve } from 'path';
import * as ts from 'typescript';
import type { RspackOptionsNormalized } from '@rspack/core';
import { buildServePath } from '../../../executors/dev-server/lib/serve-path';
import type { DevServerExecutorSchema as DevServerExecutorOptions } from '../../../executors/dev-server/schema';
import { toPropertyAssignment } from './ast';
import type { MigrationContext, TransformerContext } from './types';

export function servePostTargetTransformerFactory(
  migrationContext: MigrationContext
) {
  return async function servePostTargetTransformer(
    target: TargetConfiguration,
    tree: Tree,
    projectDetails: { projectName: string; root: string },
    inferredTarget: TargetConfiguration
  ): Promise<TargetConfiguration> {
    const context: TransformerContext = {
      ...migrationContext,
      projectName: projectDetails.projectName,
      projectRoot: projectDetails.root,
    };

    const { devServerOptions, rspackConfigPath } = await processOptions(
      tree,
      target,
      context
    );

    updateRspackConfig(tree, rspackConfigPath, devServerOptions, context);

    if (target.outputs) {
      processTargetOutputs(target, [], inferredTarget, {
        projectName: projectDetails.projectName,
        projectRoot: projectDetails.root,
      });
    }

    return target;
  };
}

type RspackConfigDevServerOptions = RspackOptionsNormalized['devServer'];
type ExtractedOptions = {
  default: RspackConfigDevServerOptions;
  [configName: string]: RspackConfigDevServerOptions;
};

async function processOptions(
  tree: Tree,
  target: TargetConfiguration<DevServerExecutorOptions>,
  context: TransformerContext
): Promise<{
  devServerOptions: ExtractedOptions;
  rspackConfigPath: string;
}> {
  const executorContext = {
    cwd: process.cwd(),
    nxJsonConfiguration: readJson(tree, 'nx.json'),
    projectGraph: context.projectGraph,
    projectName: context.projectName,
    projectsConfigurations: Object.entries(context.projectGraph.nodes).reduce(
      (acc, [projectName, project]) => {
        acc.projects[projectName] = project.data;
        return acc;
      },
      { version: 1, projects: {} } as ProjectsConfigurations
    ),
    root: context.workspaceRoot,
  } as ExecutorContext;
  const buildTarget = parseTargetString(
    target.options.buildTarget,
    executorContext
  );
  const buildOptions = readTargetOptions(buildTarget, executorContext);

  // it must exist, we validated it in the project filter
  const rspackConfigPath = buildOptions.rspackConfig;

  const defaultOptions = extractDevServerOptions(target.options, context);
  applyDefaults(defaultOptions, buildOptions);
  const devServerOptions: ExtractedOptions = {
    default: defaultOptions,
  };

  if (target.configurations && Object.keys(target.configurations).length) {
    for (const [configName, config] of Object.entries(target.configurations)) {
      devServerOptions[configName] = extractDevServerOptions(config, context);
    }
  }

  return { devServerOptions, rspackConfigPath: rspackConfigPath };
}

function extractDevServerOptions(
  options: DevServerExecutorOptions,
  context: TransformerContext
): RspackConfigDevServerOptions {
  const devServerOptions: RspackConfigDevServerOptions = {};

  for (const [key, value] of Object.entries(options)) {
    if (key === 'ssl' || key === 'sslCert' || key === 'sslKey') {
      if (key === 'ssl' || 'ssl' in options) {
        if (options.ssl) {
          devServerOptions.server = { type: 'https' };

          if (options.sslCert && options.sslKey) {
            devServerOptions.server.options = {};
            devServerOptions.server.options.cert = toProjectRelativePath(
              options.sslCert,
              context.projectRoot
            );
            devServerOptions.server.options.key = toProjectRelativePath(
              options.sslKey,
              context.projectRoot
            );
          } else if (options.sslCert) {
            context.logger.addLog({
              executorName: '@nx/rspack:dev-server',
              log: 'The "sslCert" option was set but "sslKey" was missing and "ssl" was set to "true". This means that "sslCert" was ignored by the executor. It has been removed from the options.',
              project: context.projectName,
            });
          } else if (options.sslKey) {
            context.logger.addLog({
              executorName: '@nx/rspack:dev-server',
              log: 'The "sslKey" option was set but "sslCert" was missing and "ssl" was set to "true". This means that "sslKey" was ignored by the executor. It has been removed from the options.',
              project: context.projectName,
            });
          }
        } else if (options.sslCert || options.sslKey) {
          context.logger.addLog({
            executorName: '@nx/rspack:dev-server',
            log: 'The "sslCert" and/or "sslKey" were set with "ssl" set to "false". This means they were ignored by the executor. They have been removed from the options.',
            project: context.projectName,
          });
        }
        delete options.ssl;
        delete options.sslCert;
        delete options.sslKey;
      } else if (options.sslCert || options.sslKey) {
        context.logger.addLog({
          executorName: '@nx/rspack:dev-server',
          log: 'The "sslCert" and/or "sslKey" were set but the "ssl" was not set. This means they were ignored by the executor. They have been removed from the options.',
          project: context.projectName,
        });
        delete options.sslCert;
        delete options.sslKey;
      }
    } else if (key === 'buildTarget') {
      delete options.buildTarget;
    } else {
      devServerOptions[key] = value;
      delete options[key];
    }
  }

  return devServerOptions;
}

function applyDefaults(
  options: RspackConfigDevServerOptions,
  buildOptions: any
) {
  if (options.port === undefined) {
    options.port = 4200;
  }

  options.headers = { 'Access-Control-Allow-Origin': '*' };

  const servePath = buildServePath(buildOptions);
  options.historyApiFallback = {
    index: buildOptions.index && `${servePath}${basename(buildOptions.index)}`,
    disableDotRule: true,
    htmlAcceptHeaders: ['text/html', 'application/xhtml+xml'],
  };
}

function getProxyConfig(root: string, proxyConfig: string) {
  const proxyPath = resolve(root, proxyConfig);
  return require(proxyPath);
}

function updateRspackConfig(
  tree: Tree,
  rspackConfigPath: string,
  devServerOptions: ExtractedOptions,
  context: TransformerContext
): void {
  let sourceFile: ts.SourceFile;
  let rspackConfigText: string;

  const updateSources = () => {
    rspackConfigText = tree.read(rspackConfigPath, 'utf-8');
    sourceFile = tsquery.ast(rspackConfigText);
  };
  updateSources();

  setOptionsInRspackConfig(
    tree,
    rspackConfigText,
    sourceFile,
    rspackConfigPath,
    devServerOptions
  );
  updateSources();

  setDevServerOptionsInRspackConfig(
    tree,
    rspackConfigText,
    sourceFile,
    rspackConfigPath,
    context
  );
}

function setOptionsInRspackConfig(
  tree: Tree,
  text: string,
  sourceFile: ts.SourceFile,
  rspackConfigPath: string,
  devServerOptions: ExtractedOptions
) {
  const { default: defaultOptions, ...configurationOptions } = devServerOptions;

  const configValuesSelector =
    'VariableDeclaration:has(Identifier[name=configValues]) ObjectLiteralExpression';
  const configValuesObject = tsquery<ts.ObjectLiteralExpression>(
    sourceFile,
    configValuesSelector
  )[0];

  // configValues must exist at this point, we added it when processing the build target

  /**
   * const configValues = {
   *   ...
   *   serve: {
   *     default: { ... },
   *     configuration1: { ... },
   *    ...
   *  },
   */
  const updatedConfigValuesObject = ts.factory.updateObjectLiteralExpression(
    configValuesObject,
    [
      ...configValuesObject.properties,
      ts.factory.createPropertyAssignment(
        'serve',
        ts.factory.createObjectLiteralExpression([
          ts.factory.createPropertyAssignment(
            'default',
            ts.factory.createObjectLiteralExpression(
              Object.entries(defaultOptions).map(([key, value]) =>
                toPropertyAssignment(key, value)
              )
            )
          ),
          ...(configurationOptions
            ? Object.entries(configurationOptions).map(([key, value]) =>
                ts.factory.createPropertyAssignment(
                  key,
                  ts.factory.createObjectLiteralExpression(
                    Object.entries(value).map(([key, value]) =>
                      toPropertyAssignment(key, value)
                    )
                  )
                )
              )
            : []),
        ])
      ),
    ]
  );

  text = `${text.slice(0, configValuesObject.getStart())}${ts
    .createPrinter()
    .printNode(
      ts.EmitHint.Unspecified,
      updatedConfigValuesObject,
      sourceFile
    )}${text.slice(configValuesObject.getEnd())}`;

  tree.write(rspackConfigPath, text);

  sourceFile = tsquery.ast(text);
  const buildOptionsSelector =
    'VariableStatement:has(VariableDeclaration:has(Identifier[name=buildOptions]))';
  const buildOptionsStatement = tsquery<ts.VariableStatement>(
    sourceFile,
    buildOptionsSelector
  )[0];

  text = `${text.slice(0, buildOptionsStatement.getEnd())}
  const devServerOptions = {
    ...configValues.serve.default,
    ...configValues.serve[configuration],
  };${text.slice(buildOptionsStatement.getEnd())}`;

  tree.write(rspackConfigPath, text);
}

function setDevServerOptionsInRspackConfig(
  tree: Tree,
  text: string,
  sourceFile: ts.SourceFile,
  rspackConfigPath: string,
  context: TransformerContext
) {
  const rspackConfigDevServerSelector =
    'ObjectLiteralExpression > PropertyAssignment:has(Identifier[name=devServer])';
  const rspackConfigDevServer = tsquery<ts.PropertyAssignment>(
    sourceFile,
    rspackConfigDevServerSelector
  )[0];
  if (rspackConfigDevServer) {
    context.logger.addLog({
      executorName: '@nx/rspack:dev-server',
      log: `The "devServer" option is already set in the rspack config. The migration doesn't support updating it. Please review it and make any necessary changes manually.`,
      project: context.projectName,
    });

    text = `${text.slice(
      0,
      rspackConfigDevServer.getStart()
    )}// This is the untouched "devServer" option from the original rspack config. Please review it and make any necessary changes manually.
    ${text.slice(rspackConfigDevServer.getStart())}`;

    tree.write(rspackConfigPath, text);

    // If the devServer property already exists, we don't know how to merge the
    // options, so we leave it as is.
    return;
  }

  const rspackConfigSelector =
    'ObjectLiteralExpression:has(PropertyAssignment:has(Identifier[name=plugins]))';
  const rspackConfig = tsquery<ts.ObjectLiteralExpression>(
    sourceFile,
    rspackConfigSelector
  )[0];

  const updatedRspackConfig = ts.factory.updateObjectLiteralExpression(
    rspackConfig,
    [
      ts.factory.createPropertyAssignment(
        'devServer',
        ts.factory.createIdentifier('devServerOptions')
      ),
      ...rspackConfig.properties,
    ]
  );

  text = `${text.slice(0, rspackConfig.getStart())}${ts
    .createPrinter()
    .printNode(
      ts.EmitHint.Unspecified,
      updatedRspackConfig,
      sourceFile
    )}${text.slice(rspackConfig.getEnd())}`;

  tree.write(rspackConfigPath, text);
}
