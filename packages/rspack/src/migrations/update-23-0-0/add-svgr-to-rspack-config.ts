import { forEachExecutorOptions } from '@nx/devkit/internal';
import {
  type Tree,
  formatFiles,
  applyChangesToString,
  ChangeType,
  type StringChange,
} from '@nx/devkit';
import { ast, query } from '@phenomnomnominal/tsquery';
import * as ts from 'typescript';

const withSvgrFunctionForWithReact = `

// SVGR support function (migrated from svgr option in withReact/NxReactRspackPlugin)
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

    config.module.rules.push(
      {
        test: /\\.svg$/i,
        type: 'asset',
        resourceQuery: /url/, // *.svg?url
      },
      {
        test: /\\.svg$/i,
        issuer: /\\.[jt]sx?$/,
        resourceQuery: { not: [/url/] },
        use: [{ loader: '@svgr/webpack', options }],
      }
    );

    return config;
  };
}
`;

const withSvgrFunctionForNxReactRspackPlugin = `

// SVGR support function (migrated from svgr option in withReact/NxReactRspackPlugin)
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

        compiler.options.module.rules.push(
          {
            test: /\\.svg$/i,
            type: 'asset',
            resourceQuery: /url/,
          },
          {
            test: /\\.svg$/i,
            issuer: /\\.[jt]sx?$/,
            resourceQuery: { not: [/url/] },
            use: [{ loader: '@svgr/webpack', options }],
          }
        );
      },
    });
    return config;
  };
}
`;

export default async function addSvgrToRspackConfig(tree: Tree) {
  const projects = new Map<
    string,
    { svgrOptions?: any; isWithReact: boolean }
  >();

  // Find all React rspack projects using either withReact OR NxReactRspackPlugin
  forEachExecutorOptions(
    tree,
    '@nx/rspack:rspack',
    (options: any, project, target) => {
      if (!options.rspackConfig) return;

      const rspackConfigPath = options.rspackConfig as string;
      if (!tree.exists(rspackConfigPath)) return;

      const content = tree.read(rspackConfigPath, 'utf-8');

      const sourceFile = ast(content);

      // Check if this is a withReact setup
      if (content.includes('withReact')) {
        const withReactCalls = query(
          sourceFile,
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

            projects.set(rspackConfigPath, {
              svgrOptions: svgrValue,
              isWithReact: true,
            });
          }
        }
      }
      // Otherwise check if this is NxReactRspackPlugin setup
      else if (content.includes('NxReactRspackPlugin')) {
        const pluginCalls = query(
          sourceFile,
          'NewExpression[expression.name=NxReactRspackPlugin]'
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
              projects.set(rspackConfigPath, {
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

  // Update rspack configs to add withSvgr function inline
  for (const [rspackConfigPath, config] of projects.entries()) {
    let content = tree.read(rspackConfigPath, 'utf-8');
    const sourceFile = ast(content);
    const changes: StringChange[] = [];

    // Build the svgr options for this specific config
    let svgrOptionsStr = '';

    if (config.svgrOptions) {
      const importStatements = query(sourceFile, 'ImportDeclaration');
      const requireStatements = query(
        sourceFile,
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
            : withSvgrFunctionForNxReactRspackPlugin,
        });
      } else {
        changes.push({
          type: ChangeType.Insert,
          index: 0,
          text:
            (config.isWithReact
              ? withSvgrFunctionForWithReact
              : withSvgrFunctionForNxReactRspackPlugin) + '\n',
        });
      }
    }

    // Remove svgr option based on the style (withReact OR NxReactRspackPlugin)
    if (config.isWithReact) {
      const withReactCalls = query(
        sourceFile,
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
              const hasOnlySvgrProperty = arg.properties.length === 1;

              if (hasOnlySvgrProperty) {
                changes.push({
                  type: ChangeType.Delete,
                  start: arg.getStart(),
                  length: arg.getEnd() - arg.getStart(),
                });
              } else {
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

              if (config.svgrOptions) {
                const composePluginsCalls = query(
                  sourceFile,
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
      // Remove svgr option from first NxReactRspackPlugin call
      const pluginCalls = query(
        sourceFile,
        'NewExpression[expression.name=NxReactRspackPlugin]'
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
                changes.push({
                  type: ChangeType.Delete,
                  start: arg.getStart(),
                  length: arg.getEnd() - arg.getStart(),
                });
              } else {
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

      // For NxReactRspackPlugin style, wrap the entire module.exports or export default with withSvgr
      if (config.svgrOptions) {
        const allAssignments = query(sourceFile, 'BinaryExpression');

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

        const exportDefaultStatements = query(sourceFile, 'ExportAssignment');
        const exportDefaultStatement = exportDefaultStatements[0] as
          | ts.ExportAssignment
          | undefined;

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

    tree.write(rspackConfigPath, content);
  }

  await formatFiles(tree);
}
