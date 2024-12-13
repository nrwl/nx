import { type Tree } from '@nx/devkit';
import { tsquery } from '@phenomnomnominal/tsquery';

const DEFINE_CONFIG_SELECTOR =
  'CallExpression:has(Identifier[name=defineConfig]) > ObjectLiteralExpression';
const PLUGINS_ARRAY_SELECTOR =
  'CallExpression:has(Identifier[name=defineConfig]) PropertyAssignment:has(Identifier[name=plugins]) > ArrayLiteralExpression';

export function addBuildPlugin(
  tree: Tree,
  pathToConfigFile: string,
  importPath: string,
  pluginName: string,
  options?: string
) {
  let configContents = tree.read(pathToConfigFile, 'utf-8');
  configContents = `import { ${pluginName} } from '${importPath}';
  ${configContents}`;

  const ast = tsquery.ast(configContents);

  const pluginsArrayNodes = tsquery(ast, PLUGINS_ARRAY_SELECTOR);
  if (pluginsArrayNodes.length === 0) {
    const defineConfigNodes = tsquery(ast, DEFINE_CONFIG_SELECTOR);
    if (defineConfigNodes.length === 0) {
      throw new Error('Could not find defineConfig in the config file');
    }
    const defineConfigNode = defineConfigNodes[0];
    configContents = `${configContents.slice(
      0,
      defineConfigNode.getStart() + 1
    )}
    plugins: [${pluginName}(${options ?? ''})],${configContents.slice(
      defineConfigNode.getStart() + 1
    )}`;
  } else {
    const pluginsArrayNode = pluginsArrayNodes[0];
    const pluginsArrayContents = pluginsArrayNode.getText();
    const newPluginsArrayContents = `[${
      pluginsArrayContents.length > 2
        ? `${pluginsArrayContents.slice(
            1,
            pluginsArrayContents.length - 1
          )},${pluginName}`
        : pluginName
    }(${options ?? ''})]`;
    configContents = `${configContents.slice(
      0,
      pluginsArrayNode.getStart()
    )}${newPluginsArrayContents}${configContents.slice(
      pluginsArrayNode.getEnd()
    )}`;
  }

  tree.write(pathToConfigFile, configContents);
}
