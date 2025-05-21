import { logger, Tree } from '@nx/devkit';
import { loadConfigFile } from '@nx/devkit/src/utils/config-utils';
import { join, relative } from 'path';
import { tsquery } from '@phenomnomnominal/tsquery';

const FILE_EXTENSION_REGEX = /\.[^.]+$/;

export async function getCustomWebpackConfig(
  tree: Tree,
  projectRoot: string,
  pathToCustomWebpackConfig: string
) {
  const webpackConfigContents = tree.read(pathToCustomWebpackConfig, 'utf-8');
  if (
    webpackConfigContents.includes('@nx/module-federation/angular') &&
    webpackConfigContents.includes('withModuleFederation')
  ) {
    tree.write(
      pathToCustomWebpackConfig,
      convertWebpackConfigToUseNxModuleFederationPlugin(webpackConfigContents)
    );
    return {
      isWebpackConfigFunction: false,
      normalizedPathToCustomWebpackConfig: `./${relative(
        projectRoot,
        pathToCustomWebpackConfig
      ).replace(FILE_EXTENSION_REGEX, '')}`,
    };
  }
  const configFile = await loadConfigFile(
    join(tree.root, pathToCustomWebpackConfig)
  );
  const webpackConfig =
    'default' in configFile ? configFile.default : configFile;
  return {
    isWebpackConfigFunction: typeof webpackConfig === 'function',
    normalizedPathToCustomWebpackConfig: `./${relative(
      projectRoot,
      pathToCustomWebpackConfig
    ).replace(FILE_EXTENSION_REGEX, '')}`,
  };
}

export function convertWebpackConfigToUseNxModuleFederationPlugin(
  webpackConfigContents: string
): string {
  let newWebpackConfigContents = webpackConfigContents;
  let ast = tsquery.ast(webpackConfigContents);

  const withModuleFederationImportNodes = tsquery(
    ast,
    'ImportDeclaration:has(StringLiteral[value=@nx/module-federation/angular])'
  );
  if (withModuleFederationImportNodes.length > 0) {
    const withModuleFederationImportNode = withModuleFederationImportNodes[0];
    newWebpackConfigContents = `${webpackConfigContents.slice(
      0,
      withModuleFederationImportNode.getStart()
    )}import { NxModuleFederationPlugin, NxModuleFederationDevServerPlugin } from '@nx/module-federation/angular';${webpackConfigContents.slice(
      withModuleFederationImportNode.getEnd()
    )}`;

    ast = tsquery.ast(newWebpackConfigContents);
    const exportedWithModuleFederationNodes = tsquery(
      ast,
      'ExportAssignment:has(CallExpression > Identifier[name=withModuleFederation])'
    );
    if (exportedWithModuleFederationNodes.length > 0) {
      const exportedWithModuleFederationNode =
        exportedWithModuleFederationNodes[0];
      newWebpackConfigContents = `${newWebpackConfigContents.slice(
        0,
        exportedWithModuleFederationNode.getStart()
      )}${newWebpackConfigContents.slice(
        exportedWithModuleFederationNode.getEnd()
      )}
    export default {
      plugins: [
        new NxModuleFederationPlugin({ config }, {
          dts: false,
        }),
        new NxModuleFederationDevServerPlugin({ config }),
      ]
    }
    `;
    } else {
      logger.warn(
        "Could not find 'export default withModuleFederation' in the webpack config file. Skipping conversion."
      );
    }
  }

  const withModuleFederationRequireNodes = tsquery(
    ast,
    'VariableStatement:has(CallExpression > Identifier[name=withModuleFederation], StringLiteral[value=@nx/module-federation/angular])'
  );
  if (withModuleFederationRequireNodes.length > 0) {
    const withModuleFederationRequireNode = withModuleFederationRequireNodes[0];
    newWebpackConfigContents = `${webpackConfigContents.slice(
      0,
      withModuleFederationRequireNode.getStart()
    )}const { NxModuleFederationPlugin, NxModuleFederationDevServerPlugin } = require('@nx/module-federation/rspack');${webpackConfigContents.slice(
      withModuleFederationRequireNode.getEnd()
    )}`;

    ast = tsquery.ast(newWebpackConfigContents);
    const exportedWithModuleFederationNodes = tsquery(
      ast,
      'ExpressionStatement:has(BinaryExpression > PropertyAccessExpression:has(Identifier[name=module], Identifier[name=exports]), CallExpression:has(Identifier[name=withModuleFederation]))'
    );
    if (exportedWithModuleFederationNodes.length > 0) {
      const exportedWithModuleFederationNode =
        exportedWithModuleFederationNodes[0];
      newWebpackConfigContents = `${newWebpackConfigContents.slice(
        0,
        exportedWithModuleFederationNode.getStart()
      )}${newWebpackConfigContents.slice(
        exportedWithModuleFederationNode.getEnd()
      )}
    module.exports = {
      plugins: [
        new NxModuleFederationPlugin({ config }, {
          dts: false,
        }),
        new NxModuleFederationDevServerPlugin({ config }),
      ]
    }
    `;
    } else {
      logger.warn(
        "Could not find 'module.exports = withModuleFederation' in the webpack config file. Skipping conversion."
      );
    }
  }

  return newWebpackConfigContents;
}
