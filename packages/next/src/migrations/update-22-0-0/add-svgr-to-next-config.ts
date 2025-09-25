import {
  type Tree,
  formatFiles,
  readProjectConfiguration,
  logger,
  addDependenciesToPackageJson,
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

    // Remove nx.svgr option using regex
    // First pattern: svgr is the first property (svgr: X,)
    content = content.replace(
      /(nx:\s*\{)(\s*svgr:\s*(?:true|false|\{[^}]*\}),)(\s*)/g,
      '$1$3'
    );

    // Second pattern: svgr is not the first property (, svgr: X)
    content = content.replace(/(,)(\s*svgr:\s*(?:true|false|\{[^}]*\}))/g, '');

    // Third pattern: svgr is the only property
    content = content.replace(
      /(nx:\s*\{)(\s*svgr:\s*(?:true|false|\{[^}]*\}))(\s*\})/g,
      '$1$3'
    );

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

      // Since we're using the nextConfig pattern, we know there's a plugins array
      // Add the withSvgr function definition after the plugins array
      content = content.replace(
        /const plugins = \[([\s\S]*?)\];/,
        (match, pluginList) => {
          return `const plugins = [${pluginList}];

// Add SVGR webpack config function
const withSvgr = ${svgrWebpackFunction};
`;
        }
      );

      // Update the composePlugins call to include withSvgr as the last argument
      content = content.replace(
        /composePlugins\s*\(\s*\.\.\.plugins\s*\)\s*\(\s*nextConfig\s*\)/,
        'composePlugins(...plugins, withSvgr)(nextConfig)'
      );
    }

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
