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

  // Find all Next.js projects using withNx that have svgr explicitly set to true
  forEachExecutorOptions(
    tree,
    '@nx/next:build',
    (options: any, project, target) => {
      const projectConfig = readProjectConfiguration(tree, project);
      const nextConfigPath = `${projectConfig.root}/next.config.js`;

      if (!tree.exists(nextConfigPath)) return;
      const content = tree.read(nextConfigPath, 'utf-8');

      if (!content.includes('withNx')) return;
      // Parse the file to check for nx.svgr options
      const ast = tsquery.ast(content);

      let svgrValue: boolean | Record<string, unknown> | undefined;

      // Look for nextConfig const pattern (most common from Nx generator)
      const nextConfigDeclarations = tsquery(
        ast,
        'VariableDeclaration:has(Identifier[name=nextConfig]) > ObjectLiteralExpression'
      );

      if (nextConfigDeclarations.length > 0) {
        const objLiteral =
          nextConfigDeclarations[0] as ts.ObjectLiteralExpression;

        // Look for nx property
        const nxProp = objLiteral.properties.find(
          (prop) =>
            ts.isPropertyAssignment(prop) &&
            ts.isIdentifier(prop.name) &&
            prop.name.text === 'nx'
        ) as ts.PropertyAssignment | undefined;

        if (nxProp && ts.isObjectLiteralExpression(nxProp.initializer)) {
          // Look for svgr property in nx object
          const svgrProp = nxProp.initializer.properties.find(
            (prop) =>
              ts.isPropertyAssignment(prop) &&
              ts.isIdentifier(prop.name) &&
              prop.name.text === 'svgr'
          ) as ts.PropertyAssignment | undefined;

          if (svgrProp) {
            // Found svgr option - extract its value
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
            } else {
              svgrValue =
                svgrProp.initializer.kind === ts.SyntaxKind.TrueKeyword;
            }
          }
        }
      }

      // Add to projects if svgr needs migration (true or options) or removal (false)
      if (svgrValue === undefined) return;

      // For svgr: false, we still need to track it to remove the property
      projects.set(nextConfigPath, {
        svgrOptions: svgrValue,
      });
    }
  );

  // Early exit if no projects need migration
  if (projects.size === 0) {
    return;
  }

  // Update next.config.js files to add SVGR webpack configuration
  for (const [nextConfigPath, config] of projects.entries()) {
    let content = tree.read(nextConfigPath, 'utf-8');
    const ast = tsquery.ast(content);
    const changes: StringChange[] = [];

    // Remove nx.svgr option using AST
    const nextConfigDeclarations = tsquery(
      ast,
      'VariableDeclaration:has(Identifier[name=nextConfig]) > ObjectLiteralExpression'
    );

    if (nextConfigDeclarations.length > 0) {
      const objLiteral = nextConfigDeclarations[0] as ts.ObjectLiteralExpression;

      // Find nx property
      const nxProp = objLiteral.properties.find(
        (prop) =>
          ts.isPropertyAssignment(prop) &&
          ts.isIdentifier(prop.name) &&
          prop.name.text === 'nx'
      ) as ts.PropertyAssignment | undefined;

      if (nxProp && ts.isObjectLiteralExpression(nxProp.initializer)) {
        // Find svgr property in nx object
        const svgrProp = nxProp.initializer.properties.find(
          (prop) =>
            ts.isPropertyAssignment(prop) &&
            ts.isIdentifier(prop.name) &&
            prop.name.text === 'svgr'
        ) as ts.PropertyAssignment | undefined;

        if (svgrProp) {
          const nxObj = nxProp.initializer;
          const hasOnlySvgrProperty = nxObj.properties.length === 1;

          if (hasOnlySvgrProperty) {
            // Replace the nx object with an empty object if svgr is the only property
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
          } else {
            // Remove just the svgr property from nx object
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

    // Only add SVGR webpack config if svgrOptions is true or an object (not false)
    if (config.svgrOptions === true || typeof config.svgrOptions === 'object') {
      // Build the svgr options
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

      // Add SVGR webpack config function and update composePlugins
      const svgrWebpackFunction = `(config) => {
    // Add SVGR support
    config.module.rules.push({
      test: /\\.svg$/,
      issuer: { not: /\\.(css|scss|sass)$/ },
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
    return config;
  }`;

      // Find the plugins array declaration
      const pluginsArrayDeclarations = tsquery(
        ast,
        'VariableDeclaration:has(Identifier[name=plugins]) ArrayLiteralExpression'
      );

      if (pluginsArrayDeclarations.length > 0) {
        const pluginsArray = pluginsArrayDeclarations[0] as ts.ArrayLiteralExpression;

        // Add the withSvgr function definition after the plugins array
        const pluginsStatement = pluginsArray.parent.parent;
        changes.push({
          type: ChangeType.Insert,
          index: pluginsStatement.getEnd(),
          text: `\n\n// Add SVGR webpack config function\nconst withSvgr = ${svgrWebpackFunction};`,
        });
      }

      // Find and update the composePlugins call
      const composePluginsCalls = tsquery(
        ast,
        'CallExpression[expression.name=composePlugins]'
      );

      if (composePluginsCalls.length > 0) {
        const composeCall = composePluginsCalls[0] as ts.CallExpression;

        // Find the spread argument (...plugins)
        const spreadArg = composeCall.arguments.find(
          (arg) => ts.isSpreadElement(arg)
        ) as ts.SpreadElement | undefined;

        if (spreadArg) {
          // Insert withSvgr after the spread
          changes.push({
            type: ChangeType.Insert,
            index: spreadArg.getEnd(),
            text: ', withSvgr',
          });
        }
      }
    }

    // Apply all AST-based changes
    content = applyChangesToString(content, changes);
    tree.write(nextConfigPath, content);

    if (config.svgrOptions === false) {
      logger.info(`Updated ${nextConfigPath}: Removed nx.svgr configuration`);
    } else {
      logger.info(
        `Updated ${nextConfigPath}: Added SVGR webpack configuration directly to config`
      );
    }
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