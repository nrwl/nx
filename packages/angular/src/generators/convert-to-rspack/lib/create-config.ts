import { joinPathFragments, type Tree } from '@nx/devkit';

export function createConfig(
  tree: Tree,
  opts: Record<string, any>,
  configurationOptions: Record<string, Record<string, any>> = {},
  existingWebpackConfigPath?: string,
  isExistingWebpackConfigFunction?: boolean
) {
  const { root, ...createConfigOptions } = opts;
  const hasConfigurations = Object.keys(configurationOptions).length > 0;
  const expandedConfigurationOptions = hasConfigurations
    ? Object.entries(configurationOptions)
        .map(([configurationName, configurationOptions]) => {
          return `
      "${configurationName}": {
        options: {
          ${JSON.stringify(configurationOptions, undefined, 2).slice(1, -1)}
        }
      }`;
        })
        .join(',\n')
    : '';

  // @rspack/dev-server v2 dropped its webpack-dev-server dependency, which
  // set process.env.WEBPACK_SERVE on load. The rspack 2 CLI signals serve
  // mode via `RSPACK_SERVE` on the config-function env arg instead; bridge
  // it so `createConfig`'s serve detection keeps working on rspack 2.
  const serveEnvBridge = `if (env?.['RSPACK_SERVE']) {
          process.env['WEBPACK_SERVE'] ??= 'true';
        }`;

  const createConfigContents = `createConfig({
    options: {
      root: __dirname,
      ${JSON.stringify(createConfigOptions, undefined, 2).slice(1, -1)}
    }
  }${hasConfigurations ? `, {${expandedConfigurationOptions}}` : ''});`;

  const configContents = `
  import { createConfig }from '@nx/angular-rspack';
  ${
    existingWebpackConfigPath
      ? `import baseWebpackConfig from '${existingWebpackConfigPath}';
      ${
        isExistingWebpackConfigFunction
          ? ''
          : `import webpackMerge from 'webpack-merge';`
      }`
      : ''
  }
  
  ${
    existingWebpackConfigPath
      ? `export default async (env) => {
        ${serveEnvBridge}
        const baseConfig = await ${createConfigContents}
        ${
          isExistingWebpackConfigFunction
            ? `const oldConfig = await baseWebpackConfig;
        const browserConfig = baseConfig[0];
        return oldConfig(browserConfig);`
            : 'return webpackMerge(baseConfig[0], baseWebpackConfig);'
        }};`
      : `export default (env) => {
        ${serveEnvBridge}
        return ${createConfigContents}
      };`
  }`;
  tree.write(joinPathFragments(root, 'rspack.config.ts'), configContents);
}
