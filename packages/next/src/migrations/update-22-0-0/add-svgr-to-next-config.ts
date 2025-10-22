import {
  type Tree,
  formatFiles,
  readProjectConfiguration,
  logger,
  addDependenciesToPackageJson,
  applyChangesToString,
  ChangeType,
  type StringChange,
} from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';
import { tsquery } from '@phenomnomnominal/tsquery';
import * as ts from 'typescript';

export default async function addSvgrToNextConfig(tree: Tree) {
  const projects = new Map<string, { svgrOptions?: any }>();

  // Find all Next.js projects using withNx that have svgr explicitly set to true or an options object
  forEachExecutorOptions(
    tree,
    '@nx/next:build',
    (options: any, project, target) => {
      const projectConfig = readProjectConfiguration(tree, project);
      const nextConfigPath = `${projectConfig.root}/next.config.js`;

      if (!tree.exists(nextConfigPath)) return;
      const content = tree.read(nextConfigPath, 'utf-8');

      if (!content.includes('withNx')) return;
      const ast = tsquery.ast(content);

      let svgrValue: boolean | Record<string, unknown> | undefined;

      const nextConfigDeclarations = tsquery(
        ast,
        'VariableDeclaration:has(Identifier[name=nextConfig]) > ObjectLiteralExpression'
      );

      if (nextConfigDeclarations.length > 0) {
        const objLiteral =
          nextConfigDeclarations[0] as ts.ObjectLiteralExpression;

        const nxProp = objLiteral.properties.find(
          (prop) =>
            ts.isPropertyAssignment(prop) &&
            ts.isIdentifier(prop.name) &&
            prop.name.text === 'nx'
        ) as ts.PropertyAssignment | undefined;

        if (nxProp && ts.isObjectLiteralExpression(nxProp.initializer)) {
          const svgrProp = nxProp.initializer.properties.find(
            (prop) =>
              ts.isPropertyAssignment(prop) &&
              ts.isIdentifier(prop.name) &&
              prop.name.text === 'svgr'
          ) as ts.PropertyAssignment | undefined;

          if (svgrProp) {
            // It's an object with options
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
            }
            // It's a boolean
            else {
              svgrValue =
                svgrProp.initializer.kind === ts.SyntaxKind.TrueKeyword;
            }
          }
        }
      }

      // If svgr is not defined, skip this project
      if (svgrValue === undefined) return;

      projects.set(nextConfigPath, {
        svgrOptions: svgrValue,
      });
    }
  );

  if (projects.size === 0) return;

  // Update next.config.js files to add SVGR webpack configuration
  for (const [nextConfigPath, config] of projects.entries()) {
    let content = tree.read(nextConfigPath, 'utf-8');
    const ast = tsquery.ast(content);
    const changes: StringChange[] = [];

    const nextConfigDeclarations = tsquery(
      ast,
      'VariableDeclaration:has(Identifier[name=nextConfig]) > ObjectLiteralExpression'
    );

    if (nextConfigDeclarations.length > 0) {
      const objLiteral =
        nextConfigDeclarations[0] as ts.ObjectLiteralExpression;

      const nxProp = objLiteral.properties.find(
        (prop) =>
          ts.isPropertyAssignment(prop) &&
          ts.isIdentifier(prop.name) &&
          prop.name.text === 'nx'
      ) as ts.PropertyAssignment | undefined;

      if (nxProp && ts.isObjectLiteralExpression(nxProp.initializer)) {
        const svgrProp = nxProp.initializer.properties.find(
          (prop) =>
            ts.isPropertyAssignment(prop) &&
            ts.isIdentifier(prop.name) &&
            prop.name.text === 'svgr'
        ) as ts.PropertyAssignment | undefined;

        if (svgrProp) {
          const nxObj = nxProp.initializer;
          const hasOnlySvgrProperty = nxObj.properties.length === 1;

          // Remove svgr property and leave remaining ones
          if (hasOnlySvgrProperty) {
            changes.push({
              type: ChangeType.Delete,
              start: nxObj.getStart(),
              length: nxObj.getEnd() - nxObj.getStart(),
            });
            changes.push({
              type: ChangeType.Insert,
              index: nxObj.getStart(),
              text: '{}',
            });
          }
          // If svgr property is the only property, remove the entire nx object
          else {
            const propIndex = nxObj.properties.indexOf(svgrProp);
            const isLastProp = propIndex === nxObj.properties.length - 1;
            const isFirstProp = propIndex === 0;

            let removeStart = svgrProp.getFullStart();
            let removeEnd = svgrProp.getEnd();

            // Handle comma removal
            if (!isLastProp) {
              // Remove trailing comma
              const nextProp = nxObj.properties[propIndex + 1];
              removeEnd = nextProp.getFullStart();
            } else if (!isFirstProp) {
              // Remove preceding comma from previous property
              const prevProp = nxObj.properties[propIndex - 1];
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

    // Only add SVGR webpack config if svgrOptions is true or an object
    if (config.svgrOptions === true || typeof config.svgrOptions === 'object') {
      let svgrOptions = '';
      if (config.svgrOptions === true) {
        svgrOptions = `{
      svgo: false,
      titleProp: true,
      ref: true,
    }`;
      } else if (typeof config.svgrOptions === 'object') {
        const options = Object.entries(config.svgrOptions)
          .map(([key, value]) => `      ${key}: ${value}`)
          .join(',\n');
        svgrOptions = `{\n${options}\n    }`;
      }

      const svgrWebpackFunction = `(config) => {
  const originalWebpack = config.webpack;
  // @ts-ignore
  config.webpack = (webpackConfig, ctx) => {
    // Add SVGR support
    webpackConfig.module.rules.push({
      test: /\.svg$/,
      issuer: { not: /\.(css|scss|sass)$/ },
      resourceQuery: {
        not: [
          /__next_metadata__/,
          /__next_metadata_route__/,
          /__next_metadata_image_meta__/,
        ],
      },
      use: [
        {
          loader: require.resolve('@svgr/webpack'),
          options: ${svgrOptions},
        },
        {
          loader: require.resolve('file-loader'),
          options: {
            name: 'static/media/[name].[hash].[ext]',
          },
        },
      ],
    });
    return originalWebpack
      ? originalWebpack(webpackConfig, ctx)
      : webpackConfig;
  };
  return config;
};`;

      const pluginsArrayDeclarations = tsquery(
        ast,
        'VariableDeclaration:has(Identifier[name=plugins]) ArrayLiteralExpression'
      );

      if (pluginsArrayDeclarations.length > 0) {
        const pluginsArray =
          pluginsArrayDeclarations[0] as ts.ArrayLiteralExpression;

        const pluginsStatement = pluginsArray.parent.parent;
        changes.push({
          type: ChangeType.Insert,
          index: pluginsStatement.getEnd(),
          text: `\n\n// Add SVGR webpack config function\n// @ts-ignore\nconst withSvgr = ${svgrWebpackFunction};`,
        });
      }

      const composePluginsCalls = tsquery(
        ast,
        'CallExpression[expression.name=composePlugins]'
      );

      if (composePluginsCalls.length > 0) {
        const composeCall = composePluginsCalls[0] as ts.CallExpression;

        const spreadArg = composeCall.arguments.find((arg) =>
          ts.isSpreadElement(arg)
        ) as ts.SpreadElement | undefined;

        if (spreadArg) {
          changes.push({
            type: ChangeType.Insert,
            index: spreadArg.getEnd(),
            text: ', withSvgr',
          });
        }
      }
    }

    content = applyChangesToString(content, changes);
    tree.write(nextConfigPath, content);
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
