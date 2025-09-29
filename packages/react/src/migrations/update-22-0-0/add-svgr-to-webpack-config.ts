import {
  type Tree,
  formatFiles,
  logger,
  applyChangesToString,
  ChangeType,
  type StringChange,
  addDependenciesToPackageJson,
} from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';
import { tsquery } from '@phenomnomnominal/tsquery';
import * as ts from 'typescript';

const withSvgrFunctionForWithReact = `

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

const withSvgrFunctionForNxReactWebpackPlugin = `

// SVGR support function (migrated from svgr option in withReact/NxReactWebpackPlugin)
function withSvgr(svgrOptions = {}) {
  const defaultOptions = {
    svgo: false,
    titleProp: true,
    ref: true,
  };

  const options = { ...defaultOptions, ...svgrOptions };

  return (config) => {
    config.plugins.push({
      apply: (compiler) => {
        // Remove ALL existing SVG loaders
        compiler.options.module.rules = compiler.options.module.rules.filter(
          (rule) =>
            !(
              rule &&
              typeof rule === 'object' &&
              rule.test &&
              rule.test.toString().includes('svg')
            )
        );

        // Add SVGR loader with both default and named exports
        compiler.options.module.rules.push({
          test: /\.svg$/,
          issuer: /\.[jt]sx?$/,
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
      },
    });
    return config;
  };
}
`;

export default async function addSvgrToWebpackConfig(tree: Tree) {
  const projects = new Map<
    string,
    { svgrOptions?: any; isWithReact: boolean }
  >();

  // Find all React webpack projects using either withReact OR NxReactWebpackPlugin
  forEachExecutorOptions(
    tree,
    '@nx/webpack:webpack',
    (options: any, project, target) => {
      if (!options.webpackConfig) return;

      const webpackConfigPath = options.webpackConfig as string;
      if (!tree.exists(webpackConfigPath)) return;

      const content = tree.read(webpackConfigPath, 'utf-8');

      const ast = tsquery.ast(content);

      // Check if this is a withReact setup
      if (content.includes('withReact')) {
        const withReactCalls = tsquery(
          ast,
          'CallExpression[expression.name=withReact]'
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
            let svgrValue: boolean | Record<string, unknown> | undefined;
            if (ts.isObjectLiteralExpression(svgrProp.initializer)) {
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
            } else {
              svgrValue =
                svgrProp.initializer.kind === ts.SyntaxKind.TrueKeyword;
            }

            projects.set(webpackConfigPath, {
              svgrOptions: svgrValue,
              isWithReact: true,
            });
          }
        }
      }
      // Otherwise check if this is NxReactWebpackPlugin setup
      else if (content.includes('NxReactWebpackPlugin')) {
        const pluginCalls = tsquery(
          ast,
          'NewExpression[expression.name=NxReactWebpackPlugin]'
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
            let svgrValue: boolean | Record<string, unknown> | undefined;
            if (ts.isObjectLiteralExpression(svgrProp.initializer)) {
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
            } else if (
              svgrProp.initializer.kind === ts.SyntaxKind.FalseKeyword
            ) {
              svgrValue = false;
            }

            // Add to projects if svgr is explicitly set
            if (svgrValue !== undefined) {
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

  if (projects.size === 0) return;

  // Update webpack configs to add withSvgr function inline
  for (const [webpackConfigPath, config] of projects.entries()) {
    let content = tree.read(webpackConfigPath, 'utf-8');
    const ast = tsquery.ast(content);
    const changes: StringChange[] = [];

    // Build the svgr options for this specific config
    let svgrOptionsStr = '';

    if (config.svgrOptions) {
      const importStatements = tsquery(ast, 'ImportDeclaration');
      const requireStatements = tsquery(
        ast,
        'VariableStatement:has(CallExpression[expression.name=require])'
      );

      const allImportRequires = [
        ...importStatements,
        ...requireStatements,
      ].sort((a, b) => a.getEnd() - b.getEnd());
      const lastImportOrRequire =
        allImportRequires[allImportRequires.length - 1];

      if (config.svgrOptions === true || config.svgrOptions === undefined) {
        svgrOptionsStr = '';
      } else if (typeof config.svgrOptions === 'object') {
        const options = Object.entries(config.svgrOptions)
          .map(([key, value]) => `  ${key}: ${value}`)
          .join(',\n');
        svgrOptionsStr = `{\n${options}\n}`;
      }

      if (lastImportOrRequire) {
        changes.push({
          type: ChangeType.Insert,
          index: lastImportOrRequire.getEnd(),
          text: config.isWithReact
            ? withSvgrFunctionForWithReact
            : withSvgrFunctionForNxReactWebpackPlugin,
        });
      } else {
        changes.push({
          type: ChangeType.Insert,
          index: 0,
          text:
            (config.isWithReact
              ? withSvgrFunctionForWithReact
              : withSvgrFunctionForNxReactWebpackPlugin) + '\n',
        });
      }
    }

    // Remove svgr option based on the style (withReact OR NxReactWebpackPlugin)
    if (config.isWithReact) {
      // Remove svgr option from first withReact call (only one expected)
      const withReactCalls = tsquery(
        ast,
        'CallExpression[expression.name=withReact]'
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
              changes.push({
                type: ChangeType.Delete,
                start: arg.getStart(),
                length: arg.getEnd() - arg.getStart(),
              });

              if (config.svgrOptions) {
                const composePluginsCalls = tsquery(
                  ast,
                  'CallExpression[expression.name=composePlugins]'
                );

                if (composePluginsCalls.length > 0) {
                  const composeCall =
                    composePluginsCalls[0] as ts.CallExpression;
                  let svgrCallStr = '';
                  if (
                    config.svgrOptions === true ||
                    config.svgrOptions === undefined
                  ) {
                    svgrCallStr = 'withSvgr()';
                  } else if (typeof config.svgrOptions === 'object') {
                    svgrCallStr = `withSvgr(${svgrOptionsStr})`;
                  }
                  const withReactIdx = composeCall.arguments.findIndex((arg) =>
                    arg.getText().includes('withReact')
                  );
                  // Insert withSvgr as the last argument before the closing paren
                  const argToInsertAfter = composeCall.arguments[withReactIdx];
                  if (argToInsertAfter) {
                    changes.push({
                      type: ChangeType.Insert,
                      index: argToInsertAfter.getEnd(),
                      text: `, ${svgrCallStr}`,
                    });
                  }
                }
              }
            }
          }
        }
      }
    } else {
      // Remove svgr option from first NxReactWebpackPlugin call
      const pluginCalls = tsquery(
        ast,
        'NewExpression[expression.name=NxReactWebpackPlugin]'
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

              // Replace entire object argument with empty parentheses when only svgr property exists
              if (hasOnlySvgrProperty) {
                changes.push({
                  type: ChangeType.Delete,
                  start: arg.getStart(),
                  length: arg.getEnd() - arg.getStart(),
                });
              }
              // If more properties exist, just remove the svgr property
              else {
                const propIndex = arg.properties.indexOf(svgrProp);
                const isLastProp = propIndex === arg.properties.length - 1;
                const isFirstProp = propIndex === 0;

                let removeStart = svgrProp.getFullStart();
                let removeEnd = svgrProp.getEnd();

                if (!isLastProp) {
                  const nextProp = arg.properties[propIndex + 1];
                  removeEnd = nextProp.getFullStart();
                } else if (!isFirstProp) {
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

      // For NxReactWebpackPlugin style, wrap the entire module.exports or export default with withSvgr
      if (config.svgrOptions) {
        const allAssignments = tsquery(ast, 'BinaryExpression');

        // Find the one that has module.exports on the left side
        const moduleExportsAssignment = allAssignments.find((node) => {
          const binaryExpr = node as ts.BinaryExpression;
          const left = binaryExpr.left;
          return (
            ts.isPropertyAccessExpression(left) &&
            ts.isIdentifier(left.expression) &&
            left.expression.text === 'module' &&
            ts.isIdentifier(left.name) &&
            left.name.text === 'exports'
          );
        }) as ts.BinaryExpression | undefined;

        // Also check for export default
        const exportDefaultStatements = tsquery(ast, 'ExportAssignment');
        const exportDefaultStatement = exportDefaultStatements[0] as
          | ts.ExportAssignment
          | undefined;

        // Use whichever export style is found
        let exportValue: ts.Expression | undefined;
        if (moduleExportsAssignment) {
          exportValue = moduleExportsAssignment.right;
        } else if (exportDefaultStatement) {
          exportValue = exportDefaultStatement.expression;
        }

        if (exportValue) {
          let svgrCallStr = '';
          if (config.svgrOptions === true || config.svgrOptions === undefined) {
            svgrCallStr = 'withSvgr()';
          } else if (typeof config.svgrOptions === 'object') {
            const options = Object.entries(config.svgrOptions)
              .map(([key, value]) => `  ${key}: ${value}`)
              .join(',\n');
            svgrCallStr = `withSvgr({\n${options}\n})`;
          }

          changes.push({
            type: ChangeType.Insert,
            index: exportValue.getStart(),
            text: `${svgrCallStr}(`,
          });

          changes.push({
            type: ChangeType.Insert,
            index: exportValue.getEnd(),
            text: ')',
          });
        }
      }
    }

    content = applyChangesToString(content, changes);

    tree.write(webpackConfigPath, content);
  }

  await formatFiles(tree);

  // Add file-loader as a dev dependency since it's now required for SVGR
  return addDependenciesToPackageJson(
    tree,
    {},
    {
      'file-loader': '^6.2.0',
    }
  );
}
