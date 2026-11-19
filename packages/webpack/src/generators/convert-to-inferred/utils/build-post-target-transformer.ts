import type { TargetConfiguration, Tree } from '@nx/devkit';
import {
  ensureTypescript,
  printNode,
  processTargetOutputs,
  toProjectRelativePath,
  ast,
  query,
  type TypescriptAst,
} from '@nx/devkit/internal';
import type {
  CallExpression,
  NewExpression,
  ObjectLiteralExpression,
  SourceFile,
  VariableStatement,
} from 'typescript';
import type { WebpackExecutorOptions } from '../../../executors/webpack/schema';
import type { NxAppWebpackPluginOptions } from '../../../plugins/nx-webpack-plugin/nx-app-webpack-plugin-options';
import {
  appendProperties,
  hasMigratedConfigValues,
  toPropertyAssignment,
} from './ast';
import type { MigrationContext, TransformerContext } from './types';

let ts: TypescriptAst;

export function buildPostTargetTransformerFactory(
  migrationContext: MigrationContext
) {
  return function buildPostTargetTransformer(
    target: TargetConfiguration,
    tree: Tree,
    projectDetails: { projectName: string; root: string },
    inferredTarget: TargetConfiguration
  ): TargetConfiguration {
    const context: TransformerContext = {
      ...migrationContext,
      projectName: projectDetails.projectName,
      projectRoot: projectDetails.root,
    };

    // outputPath moves into the config, where `{options.outputPath}` can't resolve.
    const outputPath = target.options?.outputPath;
    if (target.outputs && typeof outputPath === 'string') {
      target.outputs = target.outputs.map((output) =>
        output.startsWith('{options.outputPath}')
          ? output.replace(
              '{options.outputPath}',
              `{workspaceRoot}/${outputPath}`
            )
          : output.replace('{options.outputPath}', outputPath)
      );
    }

    const { pluginOptions, webpackConfigPath } = processOptions(
      target,
      context
    );

    updateWebpackConfig(tree, webpackConfigPath, pluginOptions);

    if (target.outputs) {
      processTargetOutputs(target, [], inferredTarget, {
        projectName: projectDetails.projectName,
        projectRoot: projectDetails.root,
      });
    }

    return target;
  };
}

type ExtractedOptions = {
  default: NxAppWebpackPluginOptions;
  [configName: string]: NxAppWebpackPluginOptions;
};
function processOptions(
  target: TargetConfiguration<WebpackExecutorOptions>,
  context: TransformerContext
): {
  pluginOptions: ExtractedOptions;
  webpackConfigPath: string;
} {
  const webpackConfigPath = target.options.webpackConfig;
  delete target.options.webpackConfig;

  const pluginOptions: ExtractedOptions = {
    default: extractPluginOptions(target.options, context),
  };

  if (target.configurations && Object.keys(target.configurations).length) {
    for (const [configName, config] of Object.entries(target.configurations)) {
      pluginOptions[configName] = extractPluginOptions(
        config,
        context,
        configName
      );
    }
  }

  return { pluginOptions, webpackConfigPath };
}

const pathOptions = new Set([
  'babelConfig',
  'index',
  'main',
  'outputPath',
  'polyfills',
  'postcssConfig',
  'tsConfig',
]);
const assetsOptions = new Set(['assets', 'scripts', 'styles']);
function extractPluginOptions(
  options: WebpackExecutorOptions,
  context: TransformerContext,
  configName?: string
): NxAppWebpackPluginOptions {
  const pluginOptions: NxAppWebpackPluginOptions = {};

  for (const [key, value] of Object.entries(options)) {
    if (pathOptions.has(key)) {
      pluginOptions[key] = toProjectRelativePath(value, context.projectRoot);
      delete options[key];
    } else if (assetsOptions.has(key)) {
      pluginOptions[key] = value.map((asset: string | { input: string }) => {
        if (typeof asset === 'string') {
          return toProjectRelativePath(asset, context.projectRoot);
        }

        asset.input = toProjectRelativePath(asset.input, context.projectRoot);
        return asset;
      });
      delete options[key];
    } else if (key === 'fileReplacements') {
      pluginOptions.fileReplacements = value.map(
        (replacement: { replace: string; with: string }) => ({
          replace: toProjectRelativePath(
            replacement.replace,
            context.projectRoot
          ),
          with: toProjectRelativePath(replacement.with, context.projectRoot),
        })
      );
      delete options.fileReplacements;
    } else if (key === 'additionalEntryPoints') {
      pluginOptions.additionalEntryPoints = value.map((entryPoint) => {
        entryPoint.entryPath = toProjectRelativePath(
          entryPoint.entryPath,
          context.projectRoot
        );
        return entryPoint;
      });
      delete options.additionalEntryPoints;
    } else if (key === 'memoryLimit') {
      pluginOptions.memoryLimit = value;
      const serveMemoryLimit = getMemoryLimitFromServeTarget(
        context,
        configName
      );
      if (serveMemoryLimit) {
        pluginOptions.memoryLimit = Math.max(serveMemoryLimit, value);
        context.logger.addLog({
          executorName: '@nx/webpack:webpack',
          log: `The "memoryLimit" option was set in both the serve and build configurations. The migration set the higher value to the build configuration and removed the option from the serve configuration.`,
          project: context.projectName,
        });
      }
      delete options.memoryLimit;
    } else if (key === 'standardWebpackConfigFunction') {
      delete options.standardWebpackConfigFunction;
    } else {
      pluginOptions[key] = value;
      delete options[key];
    }
  }

  return pluginOptions;
}

function updateWebpackConfig(
  tree: Tree,
  webpackConfig: string,
  pluginOptions: ExtractedOptions
): void {
  let sourceFile: SourceFile;
  let webpackConfigText: string;

  const updateSources = () => {
    webpackConfigText = tree.read(webpackConfig, 'utf-8');
    sourceFile = ast(webpackConfigText);
  };
  updateSources();

  // A target kept on its executor is converted again on rerun, and its options
  // are already in the config.
  if (hasMigratedConfigValues(sourceFile, 'build')) {
    return;
  }

  setOptionsInWebpackConfig(
    tree,
    webpackConfigText,
    sourceFile,
    webpackConfig,
    pluginOptions
  );
  updateSources();

  setOptionsInNxWebpackPlugin(
    tree,
    webpackConfigText,
    sourceFile,
    webpackConfig
  );
  updateSources();

  setOptionsInLegacyNxPlugin(
    tree,
    webpackConfigText,
    sourceFile,
    webpackConfig
  );
}

function setOptionsInWebpackConfig(
  tree: Tree,
  text: string,
  sourceFile: SourceFile,
  webpackConfig: string,
  pluginOptions: ExtractedOptions
): void {
  ts ??= ensureTypescript();
  const { default: defaultOptions, ...configurationOptions } = pluginOptions;

  const optionsSelector =
    'VariableStatement:has(VariableDeclaration:has(Identifier[name=options]))';
  let optionsVariable = query<VariableStatement>(
    sourceFile,
    optionsSelector
  )[0];

  if (!optionsVariable) {
    const plugin = query<NewExpression>(
      sourceFile,
      'NewExpression:has(Identifier[name=NxAppWebpackPlugin])'
    )[0];
    const argument = plugin.arguments?.[0];
    if (argument && !ts.isObjectLiteralExpression(argument)) {
      throw new Error(
        'Move NxAppWebpackPlugin options into an object literal before converting this config.'
      );
    }
    text = `const options = ${argument?.getText(sourceFile) ?? '{}'};\n${text}`;
    sourceFile = ast(text);
    optionsVariable = query<VariableStatement>(sourceFile, optionsSelector)[0];
  }

  const optionsObject = query<ObjectLiteralExpression>(
    optionsVariable,
    'ObjectLiteralExpression'
  )[0];
  // filter out the default options that are already in the options object
  // the existing options override the options from the project.json file
  const defaultOptionsProperties = Object.entries(defaultOptions)
    .filter(
      ([key]) =>
        !optionsObject.properties.some(
          (property) =>
            ts.isPropertyAssignment(property) &&
            ts.isIdentifier(property.name) &&
            property.name.text === key
        )
    )
    .map(([key, value]) => printNode(toPropertyAssignment(key, value)));

  /**
   * const configValues = {
   *  build: {
   *   default: { ... },
   *   configuration1: { ... },
   *   configuration2: { ... },
   * }
   */
  const buildProperties = [
    `default: ${appendProperties(optionsObject, defaultOptionsProperties)}`,
    ...Object.entries(configurationOptions).map(([key, value]) =>
      printNode(
        ts.factory.createPropertyAssignment(
          key,
          ts.factory.createObjectLiteralExpression(
            Object.entries(value).map(([key, value]) =>
              toPropertyAssignment(key, value)
            )
          )
        )
      )
    ),
  ];

  text = `${text.slice(0, optionsVariable.getStart())}
    // These options were migrated by @nx/webpack:convert-to-inferred from
    // the project.json file and merged with the options in this file
    const configValues = {
      build: { ${buildProperties.join(', ')} },
    };

    // Determine the correct configValue to use based on the configuration
    const configuration = process.env.NX_TASK_TARGET_CONFIGURATION || 'default';

    const buildOptions = {
      ...configValues.build.default,
      ...configValues.build[configuration],
    };${text.slice(optionsVariable.getEnd())}`;

  // These are comments written by the `convert-config-to-webpack-plugin` that are no longer needed
  text = text
    .replace(
      `// This file was migrated using @nx/webpack:convert-config-to-webpack-plugin from your './webpack.config.old.js'`,
      ''
    )
    .replace(
      '// Please check that the options here are correct as they were moved from the old webpack.config.js to this file.',
      ''
    );

  tree.write(webpackConfig, text);
}

function setOptionsInNxWebpackPlugin(
  tree: Tree,
  text: string,
  sourceFile: SourceFile,
  webpackConfig: string
): void {
  const nxAppWebpackPluginSelector =
    'PropertyAssignment:has(Identifier[name=plugins]) NewExpression:has(Identifier[name=NxAppWebpackPlugin])';
  const nxAppWebpackPlugin = query<NewExpression>(
    sourceFile,
    nxAppWebpackPluginSelector
  )[0];

  // the NxAppWebpackPlugin must exists, otherwise, the migration doesn't run and we wouldn't reach this point
  const pluginEnd = nxAppWebpackPlugin.getEnd();
  text = nxAppWebpackPlugin.arguments
    ? `${text.slice(0, nxAppWebpackPlugin.arguments.pos)}buildOptions${text.slice(pluginEnd - 1)}`
    : `${text.slice(0, pluginEnd)}(buildOptions)${text.slice(pluginEnd)}`;

  tree.write(webpackConfig, text);
}

function setOptionsInLegacyNxPlugin(
  tree: Tree,
  text: string,
  sourceFile: SourceFile,
  webpackConfig: string
): void {
  const legacyNxPluginSelector =
    'AwaitExpression CallExpression:has(Identifier[name=useLegacyNxPlugin])';
  const legacyNxPlugin = query<CallExpression>(
    sourceFile,
    legacyNxPluginSelector
  )[0];

  if (!legacyNxPlugin) return;

  text = `${text.slice(0, legacyNxPlugin.arguments[0].getEnd())}, buildOptions${text.slice(legacyNxPlugin.getEnd() - 1)}`;

  tree.write(webpackConfig, text);
}

function getMemoryLimitFromServeTarget(
  context: TransformerContext,
  configName: string | undefined
): number | undefined {
  const { targets } = context.projectGraph.nodes[context.projectName].data;

  const serveTarget = Object.values(targets).find(
    (target) =>
      target.executor === '@nx/webpack:dev-server' ||
      target.executor === '@nrwl/web:dev-server'
  );

  if (!serveTarget) {
    return undefined;
  }

  if (configName && serveTarget.configurations?.[configName]) {
    return (
      serveTarget.configurations[configName].options?.memoryLimit ??
      serveTarget.options?.memoryLimit
    );
  }

  return serveTarget.options?.memoryLimit;
}
