import { type Tree } from '@nx/devkit';
import { indentBy } from './indent-by';
import { tsquery } from '@phenomnomnominal/tsquery';

const DEFINE_CONFIG_SELECTOR =
  'CallExpression:has(Identifier[name=defineConfig]) > ObjectLiteralExpression';

export function addHtmlTemplatePath(
  tree: Tree,
  configFilePath: string,
  templatePath: string
) {
  const HTML_CONFIG_SELECTOR =
    'CallExpression:has(Identifier[name=defineConfig]) ObjectLiteralExpression PropertyAssignment:has(Identifier[name=html]) > ObjectLiteralExpression';
  const TEMPLATE_STRING_SELECTOR =
    'PropertyAssignment:has(Identifier[name=template]) > StringLiteral';

  let configContents = tree.read(configFilePath, 'utf-8');
  const ast = tsquery.ast(configContents);

  const htmlConfigNodes = tsquery(ast, HTML_CONFIG_SELECTOR);
  if (htmlConfigNodes.length === 0) {
    const defineConfigNodes = tsquery(ast, DEFINE_CONFIG_SELECTOR);
    if (defineConfigNodes.length === 0) {
      throw new Error(
        `Could not find 'defineConfig' in the config file at ${configFilePath}.`
      );
    }
    const defineConfigNode = defineConfigNodes[0];
    configContents = `${configContents.slice(
      0,
      defineConfigNode.getStart() + 1
    )}\n${indentBy(1)(
      `html: {\n${indentBy(1)(`template: '${templatePath}'`)}\n},`
    )}\t${configContents.slice(defineConfigNode.getStart() + 1)}`;
  } else {
    const htmlConfigNode = htmlConfigNodes[0];
    const templateStringNodes = tsquery(
      htmlConfigNode,
      TEMPLATE_STRING_SELECTOR
    );
    if (templateStringNodes.length === 0) {
      configContents = `${configContents.slice(
        0,
        htmlConfigNode.getStart() + 1
      )}\n${indentBy(2)(
        `template: '${templatePath}',`
      )}\n\t\t${configContents.slice(htmlConfigNode.getStart() + 1)}`;
    } else {
      const templateStringNode = templateStringNodes[0];
      configContents = `${configContents.slice(
        0,
        templateStringNode.getStart()
      )}'${templatePath}',${configContents.slice(templateStringNode.getEnd())}`;
    }
  }

  tree.write(configFilePath, configContents);
}

export function addCopyAssets(
  tree: Tree,
  configFilePath: string,
  from: string
) {
  const OUTPUT_CONFIG_SELECTOR =
    'CallExpression:has(Identifier[name=defineConfig]) ObjectLiteralExpression PropertyAssignment:has(Identifier[name=output]) > ObjectLiteralExpression';
  const COPY_ARRAY_SELECTOR =
    'PropertyAssignment:has(Identifier[name=copy]) > ArrayLiteralExpression';

  const copyAssetArrayElement = `{ from: '${from}' }`;
  let configContents = tree.read(configFilePath, 'utf-8');
  const ast = tsquery.ast(configContents);

  const outputConfigNodes = tsquery(ast, OUTPUT_CONFIG_SELECTOR);
  if (outputConfigNodes.length === 0) {
    const defineConfigNodes = tsquery(ast, DEFINE_CONFIG_SELECTOR);
    if (defineConfigNodes.length === 0) {
      throw new Error(
        `Could not find 'defineConfig' in the config file at ${configFilePath}.`
      );
    }
    const defineConfigNode = defineConfigNodes[0];
    configContents = `${configContents.slice(
      0,
      defineConfigNode.getStart() + 1
    )}\n${indentBy(1)(
      `output: {\n${indentBy(2)(`copy: [${copyAssetArrayElement}]`)},\n}`
    )},${configContents.slice(defineConfigNode.getStart() + 1)}`;
  } else {
    const outputConfigNode = outputConfigNodes[0];
    const copyAssetsArrayNodes = tsquery(outputConfigNode, COPY_ARRAY_SELECTOR);
    if (copyAssetsArrayNodes.length === 0) {
      configContents = `${configContents.slice(
        0,
        outputConfigNode.getStart() + 1
      )}\n${indentBy(2)(
        `copy: [${copyAssetArrayElement}],`
      )}\n\t${configContents.slice(outputConfigNode.getStart() + 1)}`;
    } else {
      const copyAssetsArrayNode = copyAssetsArrayNodes[0];
      configContents = `${configContents.slice(
        0,
        copyAssetsArrayNode.getStart() + 1
      )}\n${indentBy(2)(copyAssetArrayElement)},\n\t\t${configContents.slice(
        copyAssetsArrayNode.getStart() + 1
      )}`;
    }
  }

  tree.write(configFilePath, configContents);
}

export function addExperimentalSwcPlugin(
  tree: Tree,
  configFilePath: string,
  pluginName: string
) {
  const SWC_JSC_EXPERIMENTAL_PLUGIN_ARRAY_SELECTOR =
    'CallExpression:has(Identifier[name=defineConfig]) ObjectLiteralExpression PropertyAssignment:has(Identifier[name=tools]) PropertyAssignment:has(Identifier[name=swc]) PropertyAssignment:has(Identifier[name=jsc]) PropertyAssignment:has(Identifier[name=experimental]) PropertyAssignment:has(Identifier[name=plugins])  > ArrayLiteralExpression';
  const SWC_JSC_EXPERIMENTAL_SELECTOR =
    'CallExpression:has(Identifier[name=defineConfig]) ObjectLiteralExpression PropertyAssignment:has(Identifier[name=tools]) PropertyAssignment:has(Identifier[name=swc]) PropertyAssignment:has(Identifier[name=jsc]) PropertyAssignment:has(Identifier[name=experimental]) > ObjectLiteralExpression';
  const SWC_JSC_SELECTOR =
    'CallExpression:has(Identifier[name=defineConfig]) ObjectLiteralExpression PropertyAssignment:has(Identifier[name=tools]) PropertyAssignment:has(Identifier[name=swc]) PropertyAssignment:has(Identifier[name=jsc]) > ObjectLiteralExpression';
  const SWC_SELECTOR =
    'CallExpression:has(Identifier[name=defineConfig]) ObjectLiteralExpression PropertyAssignment:has(Identifier[name=tools]) PropertyAssignment:has(Identifier[name=swc]) > ObjectLiteralExpression';
  const TOOLS_SELECTOR =
    'CallExpression:has(Identifier[name=defineConfig]) ObjectLiteralExpression PropertyAssignment:has(Identifier[name=tools]) > ObjectLiteralExpression';

  let configContents = tree.read(configFilePath, 'utf-8');
  const ast = tsquery.ast(configContents);

  const pluginToAdd = indentBy(1)(`['${pluginName}', {}],`);
  const pluginsArrayToAdd = indentBy(1)(`plugins: [\n${pluginToAdd}\n],`);
  const experimentalObjectToAdd = indentBy(1)(
    `experimental: {\n${pluginsArrayToAdd} \n},`
  );
  const jscObjectToAdd = indentBy(1)(`jsc: {\n${experimentalObjectToAdd}\n},`);
  const swcObjectToAdd = indentBy(1)(`swc: {\n${jscObjectToAdd}\n},`);
  const toolsObjectToAdd = indentBy(1)(`tools: {\n${swcObjectToAdd}\n},`);

  const toolsNodes = tsquery(ast, TOOLS_SELECTOR);
  if (toolsNodes.length === 0) {
    const defineConfigNodes = tsquery(ast, DEFINE_CONFIG_SELECTOR);
    if (defineConfigNodes.length === 0) {
      throw new Error(
        `Could not find 'defineConfig' in the config file at ${configFilePath}.`
      );
    }
    const defineConfigNode = defineConfigNodes[0];
    configContents = `${configContents.slice(
      0,
      defineConfigNode.getStart() + 1
    )}\n${toolsObjectToAdd}${configContents.slice(
      defineConfigNode.getStart() + 1
    )}`;
  } else {
    const swcNodes = tsquery(ast, SWC_SELECTOR);
    if (swcNodes.length === 0) {
      const toolsNode = toolsNodes[0];
      configContents = `${configContents.slice(
        0,
        toolsNode.getStart() + 1
      )}\n${indentBy(1)(swcObjectToAdd)}\n\t${configContents.slice(
        toolsNode.getStart() + 1
      )}`;
    } else {
      const jscNodes = tsquery(ast, SWC_JSC_SELECTOR);
      if (jscNodes.length === 0) {
        const swcNode = swcNodes[0];
        configContents = `${configContents.slice(
          0,
          swcNode.getStart() + 1
        )}\n${indentBy(2)(jscObjectToAdd)}\n\t\t${configContents.slice(
          swcNode.getStart() + 1
        )}`;
      } else {
        const experimentalNodes = tsquery(ast, SWC_JSC_EXPERIMENTAL_SELECTOR);
        if (experimentalNodes.length === 0) {
          const jscNode = jscNodes[0];
          configContents = `${configContents.slice(
            0,
            jscNode.getStart() + 1
          )}\n${indentBy(3)(
            experimentalObjectToAdd
          )}\n\t\t\t${configContents.slice(jscNode.getStart() + 1)}`;
        } else {
          const pluginsArrayNodes = tsquery(
            ast,
            SWC_JSC_EXPERIMENTAL_PLUGIN_ARRAY_SELECTOR
          );
          if (pluginsArrayNodes.length === 0) {
            const experimentalNode = experimentalNodes[0];
            configContents = `${configContents.slice(
              0,
              experimentalNode.getStart() + 1
            )}\n${indentBy(4)(
              pluginsArrayToAdd
            )}\n\t\t\t\t${configContents.slice(
              experimentalNode.getStart() + 1
            )}`;
          } else {
            const pluginsArrayNode = pluginsArrayNodes[0];
            configContents = `${configContents.slice(
              0,
              pluginsArrayNode.getStart() + 1
            )}\n${indentBy(4)(pluginToAdd)}\n\t\t\t\t\t${configContents.slice(
              pluginsArrayNode.getStart() + 1
            )}`;
          }
        }
      }
    }
  }

  tree.write(configFilePath, configContents);
}
