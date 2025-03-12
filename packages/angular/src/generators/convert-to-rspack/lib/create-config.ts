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
      ${configurationName}: {
        options: {
          ${JSON.stringify(configurationOptions, undefined, 2).slice(1, -1)}
        }
      }`;
        })
        .join(',\n')
    : '';
  const configContents = `import { resolve } from 'path';
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
    existingWebpackConfigPath ? 'const baseConfig = ' : 'export default '
  }createConfig({ 
    options: {
      root: __dirname,
      ${JSON.stringify(createConfigOptions, undefined, 2).slice(1, -1)}
    }
  }${hasConfigurations ? `, {${expandedConfigurationOptions}}` : ''});
  ${
    existingWebpackConfigPath
      ? `
    export default ${
      isExistingWebpackConfigFunction
        ? `async function (env, argv) { 
        const oldConfig = await baseWebpackConfig;
        const browserConfig = baseConfig[0];
        return oldConfig(browserConfig);
        }`
        : 'webpackMerge(baseConfig[0], baseWebpackConfig);'
    }
  `
      : ''
  }
  `;
  tree.write(joinPathFragments(root, 'rspack.config.ts'), configContents);
}
