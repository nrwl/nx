import { type Tree } from '@nx/devkit';
import { ensureTypescript } from '@nx/js/internal';
import { ast, query } from '@phenomnomnominal/tsquery';
import type * as ts from 'typescript';
import { indentBy } from './indent-by';

const DEFINE_CONFIG_CALL = 'CallExpression:has(Identifier[name=defineConfig])';
const PLUGINS_ARRAY_SELECTOR = `${DEFINE_CONFIG_CALL} PropertyAssignment:has(Identifier[name=plugins]) > ArrayLiteralExpression`;

/**
 * Adds a plugin to the build configuration.
 * @param tree - Nx Devkit Tree
 * @param pathToConfigFile - Path to the build configuration file
 * @param importPath - Path to the plugin
 * @param pluginName - Name of the plugin
 * @param options - Optional but should be defined as a string such as `property: {foo: 'bar'}`
 */
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

  const sourceFile = ast(configContents);

  const configObject = (
    query(sourceFile, DEFINE_CONFIG_CALL) as ts.CallExpression[]
  )
    .map((call) => findConfigObject(call.arguments[0]))
    .find(Boolean);
  if (!configObject) {
    throw new Error(
      `Could not find defineConfig in the config file at ${pathToConfigFile}.`
    );
  }
  // The selector also matches nested arrays such as tools.rspack.plugins.
  const pluginsArrayNode = query(sourceFile, PLUGINS_ARRAY_SELECTOR).find(
    (node) => node.parent.parent === configObject
  );
  if (!pluginsArrayNode) {
    configContents = `${configContents.slice(
      0,
      configObject.getStart() + 1
    )}\n${indentBy(1)(
      `plugins: [${pluginName}(${options ?? ''})],`
    )}\n\t${configContents.slice(configObject.getStart() + 1)}`;
  } else {
    // Without this, a prettier-style trailing comma leaves an array hole.
    const existingPlugins = pluginsArrayNode
      .getText()
      .slice(1, -1)
      .trim()
      .replace(/,$/, '');
    const newPluginsArrayContents = `[\n${indentBy(2)(
      `${
        existingPlugins ? `${existingPlugins},\n${pluginName}` : pluginName
      }(${options ? `{\n${indentBy(1)(`${options}`)}\n}` : ''})`
    )}\n\t]`;
    configContents = `${configContents.slice(
      0,
      pluginsArrayNode.getStart()
    )}${newPluginsArrayContents}${configContents.slice(
      pluginsArrayNode.getEnd()
    )}`;
  }

  tree.write(pathToConfigFile, configContents);
}

/**
 * The object `defineConfig` receives: directly, from `() => ({ ... })`, or from
 * a function body with a single `return { ... }`.
 */
export function findConfigObject(
  argument: ts.Expression | undefined
): ts.ObjectLiteralExpression | undefined {
  const tsModule = ensureTypescript();
  if (!argument) return undefined;
  if (tsModule.isObjectLiteralExpression(argument)) return argument;
  if (
    !tsModule.isArrowFunction(argument) &&
    !tsModule.isFunctionExpression(argument)
  ) {
    return undefined;
  }
  const body = argument.body;
  if (
    tsModule.isParenthesizedExpression(body) &&
    tsModule.isObjectLiteralExpression(body.expression)
  ) {
    return body.expression;
  }
  if (!tsModule.isBlock(body)) return undefined;
  const returns = findReturns(tsModule, body);
  const [only] = returns;
  return returns.length === 1 &&
    only.parent === body &&
    only.expression &&
    tsModule.isObjectLiteralExpression(only.expression)
    ? only.expression
    : undefined;
}

// Return statements of this function, not of functions nested in it
function findReturns(tsModule: typeof ts, node: ts.Node): ts.ReturnStatement[] {
  const returns: ts.ReturnStatement[] = [];
  const visit = (child: ts.Node) => {
    if (tsModule.isReturnStatement(child)) returns.push(child);
    if (tsModule.isFunctionLike(child)) return;
    tsModule.forEachChild(child, visit);
  };
  tsModule.forEachChild(node, visit);
  return returns;
}
