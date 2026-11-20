import { Tree } from '@nx/devkit';
import {
  ensureTypescript,
  ast,
  query,
  replace,
  type TypescriptAst,
} from '@nx/devkit/internal';
import type { CallExpression, Identifier, Node, NodeArray } from 'typescript';

let ts: TypescriptAst;

export function extractRspackOptions(tree: Tree, rspackConfigPath: string) {
  const source = tree.read(rspackConfigPath).toString('utf-8');
  const sourceFile = ast(source);

  const withNxQuery = 'CallExpression:has(Identifier[name="withNx"])';
  const withReactQuery = 'CallExpression:has(Identifier[name="withReact"])';
  const withWebQuery = 'CallExpression:has(Identifier[name="withWeb"])';

  const withNxCall = query(sourceFile, withNxQuery) as CallExpression[];

  const withReactCall = query(sourceFile, withReactQuery) as CallExpression[];

  const withWebCall = query(sourceFile, withWebQuery) as CallExpression[];

  // If the config is empty set to empty string to avoid undefined. Undefined is used to check if the withNx exists inside of the config file.
  let withNxConfig: Node | '' | undefined,
    withReactConfig: Node | '' | undefined;
  // Returned rather than written here so the caller can reject configs whose
  // options are not a plain literal before touching the file.
  let strippedSource: string | undefined;
  let leftoverHelpers: string[] = [];

  withWebCall.forEach((node) => {
    const argument = node.arguments[0] || '';
    withNxConfig = argument; // Since withWeb and withNx use the same config object and both should not exist in the same file, we can reuse the withNxConfig variable.
  });

  withNxCall.forEach((node) => {
    const argument = node.arguments[0] || ''; // The first argument is the config object
    withNxConfig = argument;
  });

  withReactCall.forEach((node) => {
    const argument = node.arguments[0] || '';
    withReactConfig = argument;
  });

  if (withNxConfig !== undefined) {
    // Only remove the withNx and withReact calls if they exist
    let updatedSource = removeCallExpressions(source, [
      'withNx',
      'withReact',
      'withWeb',
    ]);
    updatedSource = removeImportDeclarations(
      updatedSource,
      'withNx',
      '@nx/rspack'
    );
    updatedSource = removeImportDeclarations(
      updatedSource,
      'withWeb',
      '@nx/rspack'
    );
    updatedSource = removeImportDeclarations(
      updatedSource,
      'withReact',
      '@nx/rspack'
    );

    updatedSource = inlineComposePlugins(updatedSource);
    updatedSource = removeImportDeclarations(
      updatedSource,
      'composePlugins',
      '@nx/rspack'
    );

    strippedSource = updatedSource;
    leftoverHelpers = findHelperReferences(updatedSource);
  }

  return { withNxConfig, withReactConfig, strippedSource, leftoverHelpers };
}

const REMOVED_HELPERS = new Set([
  'composePlugins',
  'composePluginsSync',
  'withNx',
  'withWeb',
  'withReact',
]);

function findHelperReferences(source: string): string[] {
  const names = query<Identifier>(ast(source), 'Identifier')
    .map((node) => node.text)
    .filter((name) => REMOVED_HELPERS.has(name));
  return [...new Set(names)];
}

// `composePlugins` is an inert stub since Nx v24, so the old config composes its
// remaining callbacks with a local copy.
function inlineComposePlugins(source: string): string {
  let found = false;
  const updatedSource = replace(
    source,
    'CallExpression > Identifier[name="composePlugins"]',
    (node) => {
      if ((node.parent as CallExpression).expression !== node) {
        return node.getText();
      }
      found = true;
      return 'composeLegacyPlugins';
    }
  );
  if (!found) return source;

  return `${updatedSource}
function composeLegacyPlugins(...plugins) {
  return async (config, ctx) => {
    for (const plugin of plugins) {
      config = await (await plugin)(config, ctx);
    }
    return config;
  };
}
`;
}

function removeCallExpressions(
  source: string,
  functionNames: string[]
): string {
  let modifiedSource = source;
  functionNames.forEach((functionName) => {
    const callExpressionQuery = `CallExpression:has(Identifier[name="composePlugins"]) > CallExpression:has(Identifier[name="${functionName}"])`;

    let callExpression: CallExpression | undefined;
    while (
      (callExpression = query<CallExpression>(
        modifiedSource,
        callExpressionQuery
      )[0])
    ) {
      const { arguments: args } = callExpression.parent as CallExpression;
      const index = args.indexOf(callExpression);
      modifiedSource = removeRange(
        modifiedSource,
        index === -1
          ? [callExpression.getStart(), callExpression.getEnd()]
          : listElementRange(modifiedSource, args, index)
      );
    }
  });

  return modifiedSource;
}

function removeImportDeclarations(
  source: string,
  importName: string,
  moduleName: string
) {
  let updatedSource = source;
  let range: [number, number] | undefined;
  while (
    (range = findImportDeclarationRange(updatedSource, importName, moduleName))
  ) {
    updatedSource = removeRange(updatedSource, range);
  }
  return updatedSource;
}

function findImportDeclarationRange(
  source: string,
  importName: string,
  moduleName: string
): [number, number] | undefined {
  ts ??= ensureTypescript();
  for (const statement of ast(source).statements) {
    if (!ts.isVariableStatement(statement)) continue;

    const { declarations } = statement.declarationList;
    for (let index = 0; index < declarations.length; index++) {
      const { initializer, name } = declarations[index];
      if (
        !initializer ||
        !ts.isCallExpression(initializer) ||
        !ts.isIdentifier(initializer.expression) ||
        initializer.expression.text !== 'require' ||
        initializer.arguments[0]?.getText().replace(/['"]/g, '') !==
          moduleName ||
        !ts.isObjectBindingPattern(name)
      ) {
        continue;
      }

      const elementIndex = name.elements.findIndex(
        (element) => element.name.getText() === importName
      );
      if (elementIndex !== -1 && name.elements.length > 1) {
        return listElementRange(source, name.elements, elementIndex);
      }
      if (elementIndex !== -1 || name.elements.length === 0) {
        return declarations.length > 1
          ? listElementRange(source, declarations, index)
          : [statement.getStart(), statement.getEnd()];
      }
    }
  }
  return undefined;
}

// The element with one adjacent comma, so the list stays valid.
function listElementRange(
  source: string,
  elements: NodeArray<Node>,
  index: number
): [number, number] {
  const element = elements[index];
  const next = elements[index + 1];
  if (next) {
    const spaces = source.slice(next.pos, next.getStart()).match(/^[ \t]*/)[0];
    return [element.getStart(), next.pos + spaces.length];
  }
  return index > 0
    ? [elements[index - 1].getEnd(), element.getEnd()]
    : [element.getStart(), elements.end];
}

// Also removes the line when nothing else is left on it.
function removeRange(source: string, [start, end]: [number, number]): string {
  const lineStart = source.lastIndexOf('\n', start - 1) + 1;
  const lineBreak = source.indexOf('\n', end);
  const lineEnd = lineBreak === -1 ? source.length : lineBreak + 1;
  return source.slice(lineStart, start).trim() ||
    source.slice(end, lineEnd).trim()
    ? source.slice(0, start) + source.slice(end)
    : source.slice(0, lineStart) + source.slice(lineEnd);
}
