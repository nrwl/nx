import {
  type Tree,
  formatFiles,
  readProjectConfiguration,
  logger,
  applyChangesToString,
  ChangeType,
  type StringChange,
} from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';
import { tsquery } from '@phenomnomnominal/tsquery';
import * as ts from 'typescript';

export default async function addSvgrToWebpackConfig(tree: Tree) {
  const projects = new Map<
    string,
    { svgrOptions?: any; isWithReact: boolean }
  >();

  // Find all React webpack projects using either withReact OR NxReactWebpackPlugin (never both)
  forEachExecutorOptions(
    tree,
    '@nx/webpack:webpack',
    (options: any, project, target) => {
      const projectConfig = readProjectConfiguration(tree, project);
      if (!options.webpackConfig) return;

      const webpackConfigPath = options.webpackConfig as string;
      if (!tree.exists(webpackConfigPath)) return;

      const content = tree.read(webpackConfigPath, 'utf-8');

      // Parse the file to check for svgr options
      const ast = tsquery.ast(content);

      // Check if this is a withReact setup (function composition style)
      if (content.includes('withReact')) {
        // Look for first withReact call with svgr option (only one expected)
        const withReactCalls = tsquery(
          ast,
          'CallExpression:has(Identifier[name=withReact])'
        );

        if (withReactCalls.length > 0) {
          const callExpr = withReactCalls[0] as ts.CallExpression;
          if (callExpr.arguments.length === 0) return;

          const arg = callExpr.arguments[0];
          if (!ts.isObjectLiteralExpression(arg)) return;

          const svgrProp = arg.properties.find(
            (prop) =>
              ts.isPropertyAssignment(prop) &&
              ts.isIdentifier(prop.name) &&
              prop.name.text === 'svgr'
          ) as ts.PropertyAssignment | undefined;

          if (svgrProp) {
            // Found svgr option
            let svgrValue: boolean | Record<string, unknown> | undefined;
            if (ts.isObjectLiteralExpression(svgrProp.initializer)) {
              // It's an object with options
              svgrValue = {};
              for (const prop of svgrProp.initializer.properties) {
                if (!ts.isPropertyAssignment(prop)) continue;
                if (!ts.isIdentifier(prop.name)) continue;

                const key = prop.name.text;
                if (prop.initializer.kind === ts.SyntaxKind.TrueKeyword) {
                  svgrValue[key] = true;
                } else if (
                  prop.initializer.kind === ts.SyntaxKind.FalseKeyword
                ) {
                  svgrValue[key] = false;
                }
              }
            } else if (
              svgrProp.initializer.kind === ts.SyntaxKind.TrueKeyword
            ) {
              svgrValue = true;
            }

            // Only add to projects if svgr is explicitly set to true or has options
            if (
              svgrValue === true ||
              (typeof svgrValue === 'object' && svgrValue !== null)
            ) {
              projects.set(webpackConfigPath, {
                svgrOptions: svgrValue,
                isWithReact: true,
              });
            }
          }
        }
      }
      // Otherwise check if this is NxReactWebpackPlugin setup (plugin style)
      else if (content.includes('NxReactWebpackPlugin')) {
        // Look for first NxReactWebpackPlugin call with svgr option (only one expected)
        const pluginCalls = tsquery(
          ast,
          'NewExpression:has(Identifier[name=NxReactWebpackPlugin])'
        );

        if (pluginCalls.length > 0) {
          const newExpr = pluginCalls[0] as ts.NewExpression;
          if (!newExpr.arguments || newExpr.arguments.length === 0) return;

          const arg = newExpr.arguments[0];
          if (!ts.isObjectLiteralExpression(arg)) return;

          const svgrProp = arg.properties.find(
            (prop) =>
              ts.isPropertyAssignment(prop) &&
              ts.isIdentifier(prop.name) &&
              prop.name.text === 'svgr'
          ) as ts.PropertyAssignment | undefined;

          if (svgrProp) {
            // Found svgr option
            let svgrValue: boolean | Record<string, unknown> | undefined;
            if (ts.isObjectLiteralExpression(svgrProp.initializer)) {
              // It's an object with options
              svgrValue = {};
              for (const prop of svgrProp.initializer.properties) {
                if (!ts.isPropertyAssignment(prop)) continue;
                if (!ts.isIdentifier(prop.name)) continue;

                const key = prop.name.text;
                if (prop.initializer.kind === ts.SyntaxKind.TrueKeyword) {
                  svgrValue[key] = true;
                } else if (
                  prop.initializer.kind === ts.SyntaxKind.FalseKeyword
                ) {
                  svgrValue[key] = false;
                }
              }
            } else if (
              svgrProp.initializer.kind === ts.SyntaxKind.TrueKeyword
            ) {
              svgrValue = true;
            }

            // Only add to projects if svgr is explicitly set to true or has options
            if (
              svgrValue === true ||
              (typeof svgrValue === 'object' && svgrValue !== null)
            ) {
              projects.set(webpackConfigPath, {
                svgrOptions: svgrValue,
                isWithReact: false,
              });
            }
          }
        }
      }
    }
  );

  // Early exit if no projects need migration
  if (projects.size === 0) {
    return;
  }

  // Update webpack configs to add withSvgr function inline
  for (const [webpackConfigPath, config] of projects.entries()) {
    let content = tree.read(webpackConfigPath, 'utf-8');
    const ast = tsquery.ast(content);
    const changes: StringChange[] = [];

    // Add the withSvgr function definition at the top of the file after imports
    const importStatements = tsquery(ast, 'ImportDeclaration');
    const lastImport = importStatements[importStatements.length - 1];

    // Build the svgr options for this specific config
    let svgrOptionsStr = '';
    if (config.svgrOptions === true || config.svgrOptions === undefined) {
      // Use default options
      svgrOptionsStr = '';
    } else if (typeof config.svgrOptions === 'object') {
      // Build custom options as object literal
      const options = Object.entries(config.svgrOptions)
        .map(([key, value]) => `  ${key}: ${value}`)
        .join(',\n');
      svgrOptionsStr = `{\n${options}\n}`;
    }

    const withSvgrFunction = `
// SVGR support function (migrated from svgr option in withReact/NxReactWebpackPlugin)
function withSvgr(svgrOptions = {}) {
  const defaultOptions = {
    svgo: false,
    titleProp: true,
    ref: true,
  };

  const options = { ...defaultOptions, ...svgrOptions };

  return function configure(config) {
    // Remove existing SVG loader if present
    const svgLoaderIdx = config.module.rules.findIndex(
      (rule) =>
        typeof rule === 'object' &&
        typeof rule.test !== 'undefined' &&
        rule.test.toString().includes('svg')
    );

    if (svgLoaderIdx !== -1) {
      config.module.rules.splice(svgLoaderIdx, 1);
    }

    // Add SVGR loader
    config.module.rules.push({
      test: /\\.svg$/,
      issuer: /\\.(js|ts|md)x?$/,
      use: [
        {
          loader: require.resolve('@svgr/webpack'),
          options,
        },
        {
          loader: require.resolve('file-loader'),
          options: {
            name: '[name].[hash].[ext]',
          },
        },
      ],
    });

    return config;
  };
}
`;

    if (lastImport) {
      changes.push({
        type: ChangeType.Insert,
        index: lastImport.getEnd(),
        text: withSvgrFunction,
      });
    } else {
      // No imports, add at the beginning
      changes.push({
        type: ChangeType.Insert,
        index: 0,
        text: withSvgrFunction + '\n',
      });
    }

    // Remove svgr option based on the style (withReact OR NxReactWebpackPlugin)
    if (config.isWithReact) {
      // Remove svgr option from first withReact call (only one expected)
      const withReactCalls = tsquery(
        ast,
        'CallExpression:has(Identifier[name=withReact])'
      );
      if (withReactCalls.length > 0) {
        const callExpr = withReactCalls[0] as ts.CallExpression;
        if (callExpr.arguments.length > 0) {
          const arg = callExpr.arguments[0];
          if (ts.isObjectLiteralExpression(arg)) {
            const svgrProp = arg.properties.find(
              (prop) =>
                ts.isPropertyAssignment(prop) &&
                ts.isIdentifier(prop.name) &&
                prop.name.text === 'svgr'
            ) as ts.PropertyAssignment | undefined;

            if (svgrProp) {
              const hasOnlySvgrProperty = arg.properties.length === 1;

              if (hasOnlySvgrProperty) {
                // Replace entire object argument with empty parentheses
                changes.push({
                  type: ChangeType.Delete,
                  start: arg.getStart(),
                  length: arg.getEnd() - arg.getStart(),
                });
              } else {
                // Remove just the svgr property
                const propIndex = arg.properties.indexOf(svgrProp);
                const isLastProp = propIndex === arg.properties.length - 1;
                const isFirstProp = propIndex === 0;

                // Calculate removal range including whitespace and comma
                let removeStart = svgrProp.getFullStart();
                let removeEnd = svgrProp.getEnd();

                // Handle comma removal
                if (!isLastProp) {
                  // Remove trailing comma
                  const nextProp = arg.properties[propIndex + 1];
                  removeEnd = nextProp.getFullStart();
                } else if (!isFirstProp) {
                  // Remove preceding comma from previous property
                  const prevProp = arg.properties[propIndex - 1];
                  const textBetween = content.substring(
                    prevProp.getEnd(),
                    svgrProp.getFullStart()
                  );
                  const commaIndex = textBetween.indexOf(',');
                  if (commaIndex !== -1) {
                    removeStart = prevProp.getEnd() + commaIndex;
                  }
                }

                changes.push({
                  type: ChangeType.Delete,
                  start: removeStart,
                  length: removeEnd - removeStart,
                });
              }
            }
          }
        }
      }
    } else {
      // Remove svgr option from first NxReactWebpackPlugin call (only one expected)
      const pluginCalls = tsquery(
        ast,
        'NewExpression:has(Identifier[name=NxReactWebpackPlugin])'
      );
      if (pluginCalls.length > 0) {
        const newExpr = pluginCalls[0] as ts.NewExpression;
        if (newExpr.arguments && newExpr.arguments.length > 0) {
          const arg = newExpr.arguments[0];
          if (ts.isObjectLiteralExpression(arg)) {
            const svgrProp = arg.properties.find(
              (prop) =>
                ts.isPropertyAssignment(prop) &&
                ts.isIdentifier(prop.name) &&
                prop.name.text === 'svgr'
            ) as ts.PropertyAssignment | undefined;

            if (svgrProp) {
              const hasOnlySvgrProperty = arg.properties.length === 1;

              if (hasOnlySvgrProperty) {
                // Replace entire object argument with empty parentheses
                changes.push({
                  type: ChangeType.Delete,
                  start: arg.getStart(),
                  length: arg.getEnd() - arg.getStart(),
                });
              } else {
                // Remove just the svgr property
                const propIndex = arg.properties.indexOf(svgrProp);
                const isLastProp = propIndex === arg.properties.length - 1;
                const isFirstProp = propIndex === 0;

                // Calculate removal range including whitespace and comma
                let removeStart = svgrProp.getFullStart();
                let removeEnd = svgrProp.getEnd();

                // Handle comma removal
                if (!isLastProp) {
                  // Remove trailing comma
                  const nextProp = arg.properties[propIndex + 1];
                  removeEnd = nextProp.getFullStart();
                } else if (!isFirstProp) {
                  // Remove preceding comma from previous property
                  const prevProp = arg.properties[propIndex - 1];
                  const textBetween = content.substring(
                    prevProp.getEnd(),
                    svgrProp.getFullStart()
                  );
                  const commaIndex = textBetween.indexOf(',');
                  if (commaIndex !== -1) {
                    removeStart = prevProp.getEnd() + commaIndex;
                  }
                }

                changes.push({
                  type: ChangeType.Delete,
                  start: removeStart,
                  length: removeEnd - removeStart,
                });
              }
            }
          }
        }
      }
    }

    // Apply all AST-based changes
    content = applyChangesToString(content, changes);

    // For withReact style, add withSvgr to composePlugins chain
    if (config.isWithReact) {
      // Find first composePlugins call (only one expected)
      const composePluginsMatch = content.match(
        /composePlugins\s*\(\s*([\s\S]*?)\s*\)/
      );

      if (composePluginsMatch) {
        const pluginsContent = composePluginsMatch[1];

        // Build the withSvgr call string
        let svgrCallStr = '';
        if (config.svgrOptions === true || config.svgrOptions === undefined) {
          svgrCallStr = 'withSvgr()';
        } else if (typeof config.svgrOptions === 'object') {
          svgrCallStr = `withSvgr(${svgrOptionsStr})`;
        }

        // Add withSvgr as the last argument in composePlugins
        const newPluginsContent = pluginsContent.trimEnd() + ', ' + svgrCallStr;
        content = content.replace(
          composePluginsMatch[0],
          `composePlugins(${newPluginsContent})`
        );
      }
    }
    // For NxReactWebpackPlugin style, the withSvgr function is added but needs to be called differently
    // This would typically be done in the webpack config directly, not through composePlugins

    tree.write(webpackConfigPath, content);

    logger.info(
      `Updated ${webpackConfigPath}: Added SVGR webpack configuration directly to config`
    );
  }

  await formatFiles(tree);
}
