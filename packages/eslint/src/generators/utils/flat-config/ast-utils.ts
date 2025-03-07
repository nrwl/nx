import {
  applyChangesToString,
  ChangeType,
  parseJson,
  StringChange,
} from '@nx/devkit';
import { Linter } from 'eslint';
import * as ts from 'typescript';
import { mapFilePath } from './path-utils';

/**
 * Supports direct identifiers, and those nested within an object (of arbitrary depth)
 * E.g. `...foo` and `...foo.bar.baz.qux` etc
 */
const SPREAD_ELEMENTS_REGEXP = /\s*\.\.\.[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)*,?\n?/g;

/**
 * Remove all overrides from the config file
 */
export function removeOverridesFromLintConfig(content: string): string {
  const source = ts.createSourceFile(
    '',
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
  );

  const format = content.includes('export default') ? 'mjs' : 'cjs';

  const exportsArray =
    format === 'mjs' ? findExportDefault(source) : findModuleExports(source);
  if (!exportsArray) {
    return content;
  }

  const changes: StringChange[] = [];
  exportsArray.forEach((node, i) => {
    if (isOverride(node)) {
      const commaOffset =
        i < exportsArray.length - 1 || exportsArray.hasTrailingComma ? 1 : 0;
      changes.push({
        type: ChangeType.Delete,
        start: node.pos,
        length: node.end - node.pos + commaOffset,
      });
    }
  });

  return applyChangesToString(content, changes);
}

// TODO Change name
function findExportDefault(source: ts.SourceFile): ts.NodeArray<ts.Node> {
  return ts.forEachChild(source, function analyze(node) {
    if (
      ts.isExportAssignment(node) &&
      ts.isArrayLiteralExpression(node.expression)
    ) {
      return node.expression.elements;
    }
  });
}

function findModuleExports(source: ts.SourceFile): ts.NodeArray<ts.Node> {
  return ts.forEachChild(source, function analyze(node) {
    if (
      ts.isExpressionStatement(node) &&
      ts.isBinaryExpression(node.expression) &&
      node.expression.left.getText() === 'module.exports' &&
      ts.isArrayLiteralExpression(node.expression.right)
    ) {
      return node.expression.right.elements;
    }
  });
}

export function addPatternsToFlatConfigIgnoresBlock(
  content: string,
  ignorePatterns: string[]
): string {
  const source = ts.createSourceFile(
    '',
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
  );
  const format = content.includes('export default') ? 'mjs' : 'cjs';
  const exportsArray =
    format === 'mjs' ? findExportDefault(source) : findModuleExports(source);
  if (!exportsArray) {
    return content;
  }
  const changes: StringChange[] = [];
  for (const node of exportsArray) {
    if (!isFlatConfigIgnoresBlock(node)) {
      continue;
    }

    const start = node.properties.pos + 1; // keep leading line break
    const data = parseTextToJson(node.getFullText());
    changes.push({
      type: ChangeType.Delete,
      start,
      length: node.properties.end - start,
    });
    data.ignores = Array.from(
      new Set([...(data.ignores ?? []), ...ignorePatterns])
    );
    changes.push({
      type: ChangeType.Insert,
      index: start,
      text:
        '    ' +
        JSON.stringify(data, null, 2)
          .slice(2, -2) // Remove curly braces and start/end line breaks
          .replaceAll(/\n/g, '\n    '), // Maintain indentation
    });
    break;
  }
  return applyChangesToString(content, changes);
}

export function hasFlatConfigIgnoresBlock(content: string): boolean {
  const source = ts.createSourceFile(
    '',
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
  );
  const format = content.includes('export default') ? 'mjs' : 'cjs';
  const exportsArray =
    format === 'mjs' ? findExportDefault(source) : findModuleExports(source);
  if (!exportsArray) {
    return false;
  }

  return exportsArray.some(isFlatConfigIgnoresBlock);
}

function isFlatConfigIgnoresBlock(
  node: ts.Node
): node is ts.ObjectLiteralExpression {
  return (
    ts.isObjectLiteralExpression(node) &&
    node.properties.length === 1 &&
    (node.properties[0].name.getText() === 'ignores' ||
      node.properties[0].name.getText() === '"ignores"') &&
    ts.isPropertyAssignment(node.properties[0]) &&
    ts.isArrayLiteralExpression(node.properties[0].initializer)
  );
}

function isOverride(node: ts.Node): boolean {
  return (
    (ts.isObjectLiteralExpression(node) &&
      node.properties.some(
        (p) => p.name.getText() === 'files' || p.name.getText() === '"files"'
      )) ||
    // detect ...compat.config(...).map(...)
    (ts.isSpreadElement(node) &&
      ts.isCallExpression(node.expression) &&
      ts.isPropertyAccessExpression(node.expression.expression) &&
      ts.isArrowFunction(node.expression.arguments[0]) &&
      ts.isParenthesizedExpression(node.expression.arguments[0].body))
  );
}

export function hasOverride(
  content: string,
  lookup: (override: Linter.ConfigOverride<Linter.RulesRecord>) => boolean
): boolean {
  const source = ts.createSourceFile(
    '',
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
  );
  const format = content.includes('export default') ? 'mjs' : 'cjs';
  const exportsArray =
    format === 'mjs' ? findExportDefault(source) : findModuleExports(source);
  if (!exportsArray) {
    return false;
  }
  for (const node of exportsArray) {
    if (isOverride(node)) {
      let objSource;
      if (ts.isObjectLiteralExpression(node)) {
        objSource = node.getFullText();
        // strip any spread elements
        objSource = objSource.replace(SPREAD_ELEMENTS_REGEXP, '');
      } else {
        const fullNodeText =
          node['expression'].arguments[0].body.expression.getFullText();
        // strip any spread elements
        objSource = fullNodeText.replace(SPREAD_ELEMENTS_REGEXP, '');
      }
      const data = parseTextToJson(objSource);
      if (lookup(data)) {
        return true;
      }
    }
  }
  return false;
}

function parseTextToJson(text: string): any {
  return parseJson(
    text
      // ensure property names have double quotes so that JSON.parse works
      .replace(/'/g, '"')
      .replace(/\s([a-zA-Z0-9_]+)\s*:/g, ' "$1": ')
      // stringify any require calls to avoid JSON parsing errors, turn them into just the string value being required
      .replace(/require\(['"]([^'"]+)['"]\)/g, '"$1"')
      .replace(/\(?await import\(['"]([^'"]+)['"]\)\)?/g, '"$1"')
  );
}

/**
 * Finds an override matching the lookup function and applies the update function to it
 */
export function replaceOverride(
  content: string,
  root: string,
  lookup: (override: Linter.ConfigOverride<Linter.RulesRecord>) => boolean,
  update?: (
    override: Partial<Linter.ConfigOverride<Linter.RulesRecord>>
  ) => Partial<Linter.ConfigOverride<Linter.RulesRecord>>
): string {
  const source = ts.createSourceFile(
    '',
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
  );
  const format = content.includes('export default') ? 'mjs' : 'cjs';
  const exportsArray =
    format === 'mjs' ? findExportDefault(source) : findModuleExports(source);
  if (!exportsArray) {
    return content;
  }
  const changes: StringChange[] = [];
  exportsArray.forEach((node) => {
    if (isOverride(node)) {
      let objSource;
      let start, end;
      if (ts.isObjectLiteralExpression(node)) {
        objSource = node.getFullText();
        start = node.properties.pos + 1; // keep leading line break
        end = node.properties.end;
      } else {
        const fullNodeText =
          node['expression'].arguments[0].body.expression.getFullText();
        // strip any spread elements
        objSource = fullNodeText.replace(SPREAD_ELEMENTS_REGEXP, '');
        start =
          node['expression'].arguments[0].body.expression.properties.pos +
          (fullNodeText.length - objSource.length);
        end = node['expression'].arguments[0].body.expression.properties.end;
      }
      const data = parseTextToJson(objSource);
      if (lookup(data)) {
        changes.push({
          type: ChangeType.Delete,
          start,
          length: end - start,
        });
        let updatedData = update(data);
        if (updatedData) {
          updatedData = mapFilePaths(updatedData);

          const parserReplacement =
            format === 'mjs'
              ? (parser: string) => `(await import('${parser}'))`
              : (parser: string) => `require('${parser}')`;

          changes.push({
            type: ChangeType.Insert,
            index: start,
            text:
              '    ' +
              JSON.stringify(updatedData, null, 2)
                .replace(
                  /"parser": "([^"]+)"/g,
                  (_, parser) => `"parser": ${parserReplacement(parser)}`
                )
                .slice(2, -2) // Remove curly braces and start/end line breaks
                .replaceAll(/\n/g, '\n    '), // Maintain indentation
          });
        }
      }
    }
  });

  return applyChangesToString(content, changes);
}

/**
 * Adding import statement to the top of the file
 * The imports are added based on a few rules:
 * 1. If it's a default import and matches the variable, return content unchanged.
 * 2. If it's a named import and the variables are not part of the import object, add them.
 * 3. If no existing import and variable is a string, add a default import.
 * 4. If no existing import and variable is an array, add it as an object import.
 */
export function addImportToFlatConfig(
  content: string,
  variable: string | string[],
  imp: string
): string {
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const source = ts.createSourceFile(
    '',
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
  );

  const format = content.includes('export default') ? 'mjs' : 'cjs';

  if (format === 'mjs') {
    return addESMImportToFlatConfig(source, printer, content, variable, imp);
  }
  return addCJSImportToFlatConfig(source, printer, content, variable, imp);
}

function addESMImportToFlatConfig(
  source: ts.SourceFile,
  printer: ts.Printer,
  content: string,
  variable: string | string[],
  imp: string
): string {
  let existingImport: ts.ImportDeclaration | undefined;

  ts.forEachChild(source, (node) => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text === imp
    ) {
      existingImport = node;
    }
  });

  // Rule 1:
  if (
    existingImport &&
    typeof variable === 'string' &&
    existingImport.importClause?.name?.getText() === variable
  ) {
    return content;
  }

  // Rule 2:
  if (
    existingImport &&
    existingImport.importClause?.namedBindings &&
    Array.isArray(variable)
  ) {
    const namedImports = existingImport.importClause
      .namedBindings as ts.NamedImports;
    const existingElements = namedImports.elements;

    // Filter out variables that are already imported
    const newVariables = variable.filter(
      (v) => !existingElements.some((e) => e.name.getText() === v)
    );

    if (newVariables.length === 0) {
      return content;
    }

    const newImportSpecifiers = newVariables.map((v) =>
      ts.factory.createImportSpecifier(
        false,
        undefined,
        ts.factory.createIdentifier(v)
      )
    );

    const lastElement = existingElements[existingElements.length - 1];
    const insertIndex = lastElement
      ? lastElement.getEnd()
      : namedImports.getEnd();

    const insertText = printer.printList(
      ts.ListFormat.NamedImportsOrExportsElements,
      ts.factory.createNodeArray(newImportSpecifiers),
      source
    );

    return applyChangesToString(content, [
      {
        type: ChangeType.Insert,
        index: insertIndex,
        text: `, ${insertText}`,
      },
    ]);
  }

  // Rule 3:
  if (!existingImport && typeof variable === 'string') {
    const defaultImport = ts.factory.createImportDeclaration(
      undefined,
      ts.factory.createImportClause(
        false,
        ts.factory.createIdentifier(variable),
        undefined
      ),
      ts.factory.createStringLiteral(imp)
    );

    const insert = printer.printNode(
      ts.EmitHint.Unspecified,
      defaultImport,
      source
    );

    return applyChangesToString(content, [
      {
        type: ChangeType.Insert,
        index: 0,
        text: `${insert}\n`,
      },
    ]);
  }

  // Rule 4:
  if (!existingImport && Array.isArray(variable)) {
    const objectImport = ts.factory.createImportDeclaration(
      undefined,
      ts.factory.createImportClause(
        false,
        undefined,
        ts.factory.createNamedImports(
          variable.map((v) =>
            ts.factory.createImportSpecifier(
              false,
              undefined,
              ts.factory.createIdentifier(v)
            )
          )
        )
      ),
      ts.factory.createStringLiteral(imp)
    );

    const insert = printer.printNode(
      ts.EmitHint.Unspecified,
      objectImport,
      source
    );

    return applyChangesToString(content, [
      {
        type: ChangeType.Insert,
        index: 0,
        text: `${insert}\n`,
      },
    ]);
  }
}

function addCJSImportToFlatConfig(
  source: ts.SourceFile,
  printer: ts.Printer,
  content: string,
  variable: string | string[],
  imp: string
): string {
  const foundBindingVars: ts.NodeArray<ts.BindingElement> = ts.forEachChild(
    source,
    function analyze(node) {
      // we can only combine object binding patterns
      if (!Array.isArray(variable)) {
        return;
      }
      if (
        ts.isVariableStatement(node) &&
        ts.isVariableDeclaration(node.declarationList.declarations[0]) &&
        ts.isObjectBindingPattern(node.declarationList.declarations[0].name) &&
        ts.isCallExpression(node.declarationList.declarations[0].initializer) &&
        node.declarationList.declarations[0].initializer.expression.getText() ===
          'require' &&
        ts.isStringLiteral(
          node.declarationList.declarations[0].initializer.arguments[0]
        ) &&
        node.declarationList.declarations[0].initializer.arguments[0].text ===
          imp
      ) {
        return node.declarationList.declarations[0].name.elements;
      }
    }
  );

  if (foundBindingVars && Array.isArray(variable)) {
    const newVariables = variable.filter(
      (v) => !foundBindingVars.some((fv) => v === fv.name.getText())
    );
    if (newVariables.length === 0) {
      return content;
    }
    const isMultiLine = foundBindingVars.hasTrailingComma;
    const pos = foundBindingVars.end;
    const nodes = ts.factory.createNodeArray(
      newVariables.map((v) =>
        ts.factory.createBindingElement(undefined, undefined, v)
      )
    );
    const insert = printer.printList(
      ts.ListFormat.ObjectBindingPatternElements,
      nodes,
      source
    );
    return applyChangesToString(content, [
      {
        type: ChangeType.Insert,
        index: pos,
        text: isMultiLine ? `,\n${insert}` : `,${insert}`,
      },
    ]);
  }

  const hasSameIdentifierVar: boolean = ts.forEachChild(
    source,
    function analyze(node) {
      // we are searching for a single variable
      if (Array.isArray(variable)) {
        return;
      }
      if (
        ts.isVariableStatement(node) &&
        ts.isVariableDeclaration(node.declarationList.declarations[0]) &&
        ts.isIdentifier(node.declarationList.declarations[0].name) &&
        node.declarationList.declarations[0].name.getText() === variable &&
        ts.isCallExpression(node.declarationList.declarations[0].initializer) &&
        node.declarationList.declarations[0].initializer.expression.getText() ===
          'require' &&
        ts.isStringLiteral(
          node.declarationList.declarations[0].initializer.arguments[0]
        ) &&
        node.declarationList.declarations[0].initializer.arguments[0].text ===
          imp
      ) {
        return true;
      }
    }
  );

  if (hasSameIdentifierVar) {
    return content;
  }

  // the import was not found, create a new one
  const requireStatement = generateRequire(
    typeof variable === 'string'
      ? variable
      : ts.factory.createObjectBindingPattern(
          variable.map((v) =>
            ts.factory.createBindingElement(undefined, undefined, v)
          )
        ),
    imp
  );
  const insert = printer.printNode(
    ts.EmitHint.Unspecified,
    requireStatement,
    source
  );
  return applyChangesToString(content, [
    {
      type: ChangeType.Insert,
      index: 0,
      text: `${insert}\n`,
    },
  ]);
}

function existsAsNamedOrDefaultImport(
  node: ts.ImportDeclaration,
  variable: string | string[]
) {
  const isNamed =
    node.importClause.namedBindings &&
    ts.isNamedImports(node.importClause.namedBindings);
  if (Array.isArray(variable)) {
    return isNamed || variable.includes(node.importClause?.name?.getText());
  }
  return (
    (node.importClause.namedBindings &&
      ts.isNamedImports(node.importClause.namedBindings)) ||
    node.importClause?.name?.getText() === variable
  );
}
/**
 * Remove an import from flat config
 */
export function removeImportFromFlatConfig(
  content: string,
  variable: string,
  imp: string
): string {
  const source = ts.createSourceFile(
    '',
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
  );

  const format = content.includes('export default') ? 'mjs' : 'cjs';
  if (format === 'mjs') {
    return removeImportFromFlatConfigESM(source, content, variable, imp);
  } else {
    return removeImportFromFlatConfigCJS(source, content, variable, imp);
  }
}

function removeImportFromFlatConfigESM(
  source: ts.SourceFile,
  content: string,
  variable: string,
  imp: string
): string {
  const changes: StringChange[] = [];

  ts.forEachChild(source, (node) => {
    // we can only combine object binding patterns
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text === imp &&
      node.importClause &&
      existsAsNamedOrDefaultImport(node, variable)
    ) {
      changes.push({
        type: ChangeType.Delete,
        start: node.pos,
        length: node.end - node.pos,
      });
    }
  });

  return applyChangesToString(content, changes);
}

function removeImportFromFlatConfigCJS(
  source: ts.SourceFile,
  content: string,
  variable: string,
  imp: string
): string {
  const changes: StringChange[] = [];
  ts.forEachChild(source, (node) => {
    // we can only combine object binding patterns
    if (
      ts.isVariableStatement(node) &&
      ts.isVariableDeclaration(node.declarationList.declarations[0]) &&
      ts.isIdentifier(node.declarationList.declarations[0].name) &&
      node.declarationList.declarations[0].name.getText() === variable &&
      ts.isCallExpression(node.declarationList.declarations[0].initializer) &&
      node.declarationList.declarations[0].initializer.expression.getText() ===
        'require' &&
      ts.isStringLiteral(
        node.declarationList.declarations[0].initializer.arguments[0]
      ) &&
      node.declarationList.declarations[0].initializer.arguments[0].text === imp
    ) {
      changes.push({
        type: ChangeType.Delete,
        start: node.pos,
        length: node.end - node.pos,
      });
    }
  });

  return applyChangesToString(content, changes);
}

/**
 * Injects new ts.expression to the end of the module.exports or export default array.
 */
export function addBlockToFlatConfigExport(
  content: string,
  config: ts.Expression | ts.SpreadElement,
  options: { insertAtTheEnd?: boolean; checkBaseConfig?: boolean } = {
    insertAtTheEnd: true,
  }
): string {
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const source = ts.createSourceFile(
    '',
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
  );

  const format = content.includes('export default') ? 'mjs' : 'cjs';

  // find the export default array statement
  if (format === 'mjs') {
    return addBlockToFlatConfigExportESM(
      content,
      config,
      source,
      printer,
      options
    );
  } else {
    return addBlockToFlatConfigExportCJS(
      content,
      config,
      source,
      printer,
      options
    );
  }
}

function addBlockToFlatConfigExportESM(
  content: string,
  config: ts.Expression | ts.SpreadElement,
  source: ts.SourceFile,
  printer: ts.Printer,
  options: { insertAtTheEnd?: boolean; checkBaseConfig?: boolean } = {
    insertAtTheEnd: true,
  }
): string {
  const exportDefaultStatement = source.statements.find(
    (statement): statement is ts.ExportAssignment =>
      ts.isExportAssignment(statement) &&
      ts.isArrayLiteralExpression(statement.expression)
  );

  if (!exportDefaultStatement) return content;

  const exportArrayLiteral =
    exportDefaultStatement.expression as ts.ArrayLiteralExpression;

  const updatedArrayElements = options.insertAtTheEnd
    ? [...exportArrayLiteral.elements, config]
    : [config, ...exportArrayLiteral.elements];

  const updatedExportDefault = ts.factory.createExportAssignment(
    undefined,
    false,
    ts.factory.createArrayLiteralExpression(updatedArrayElements, true)
  );

  // update the existing export default array
  const updatedStatements = source.statements.map((statement) =>
    statement === exportDefaultStatement ? updatedExportDefault : statement
  );

  const updatedSource = ts.factory.updateSourceFile(source, updatedStatements);

  return printer
    .printFile(updatedSource)
    .replace(/export default/, '\nexport default');
}

function addBlockToFlatConfigExportCJS(
  content: string,
  config: ts.Expression | ts.SpreadElement,
  source: ts.SourceFile,
  printer: ts.Printer,
  options: { insertAtTheEnd?: boolean; checkBaseConfig?: boolean } = {
    insertAtTheEnd: true,
  }
): string {
  const exportsArray = ts.forEachChild(source, function analyze(node) {
    if (
      ts.isExpressionStatement(node) &&
      ts.isBinaryExpression(node.expression) &&
      node.expression.left.getText() === 'module.exports' &&
      ts.isArrayLiteralExpression(node.expression.right)
    ) {
      return node.expression.right.elements;
    }
  });

  // The config is not in the format that we generate with, skip update.
  // This could happen during `init-migration` when extracting config from the base, but
  // base config was not generated by Nx.
  if (!exportsArray) return content;

  const insert =
    '    ' +
    printer
      .printNode(ts.EmitHint.Expression, config, source)
      .replaceAll(/\n/g, '\n    ');
  if (options.insertAtTheEnd) {
    const index =
      exportsArray.length > 0
        ? exportsArray.at(exportsArray.length - 1).end
        : exportsArray.pos;
    return applyChangesToString(content, [
      {
        type: ChangeType.Insert,
        index,
        text: `,\n${insert}`,
      },
    ]);
  } else {
    const index =
      exportsArray.length > 0 ? exportsArray.at(0).pos : exportsArray.pos;
    return applyChangesToString(content, [
      {
        type: ChangeType.Insert,
        index,
        text: `\n${insert},\n`,
      },
    ]);
  }
}

export function removePlugin(
  content: string,
  pluginName: string,
  pluginImport: string
) {
  const source = ts.createSourceFile(
    '',
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
  );
  const format = content.includes('export default') ? 'mjs' : 'cjs';
  const changes: StringChange[] = [];
  if (format === 'mjs') {
    ts.forEachChild(source, function analyze(node) {
      if (
        ts.isImportDeclaration(node) &&
        ts.isStringLiteral(node.moduleSpecifier) &&
        node.moduleSpecifier.text === pluginImport
      ) {
        const importClause = node.importClause;

        if (
          (importClause && importClause.name) ||
          (importClause.namedBindings &&
            ts.isNamedImports(importClause.namedBindings))
        ) {
          changes.push({
            type: ChangeType.Delete,
            start: node.pos,
            length: node.end - node.pos,
          });
        }
      }
    });
  } else {
    ts.forEachChild(source, function analyze(node) {
      if (
        ts.isVariableStatement(node) &&
        ts.isVariableDeclaration(node.declarationList.declarations[0]) &&
        ts.isCallExpression(node.declarationList.declarations[0].initializer) &&
        node.declarationList.declarations[0].initializer.arguments.length &&
        ts.isStringLiteral(
          node.declarationList.declarations[0].initializer.arguments[0]
        ) &&
        node.declarationList.declarations[0].initializer.arguments[0].text ===
          pluginImport
      ) {
        changes.push({
          type: ChangeType.Delete,
          start: node.pos,
          length: node.end - node.pos,
        });
      }
    });
  }
  ts.forEachChild(source, function analyze(node) {
    if (
      ts.isExportAssignment(node) &&
      ts.isArrayLiteralExpression(node.expression)
    ) {
      const blockElements = node.expression.elements;
      blockElements.forEach((element) => {
        if (ts.isObjectLiteralExpression(element)) {
          const pluginsElem = element.properties.find(
            (prop) => prop.name?.getText() === 'plugins'
          ) as ts.PropertyAssignment;
          if (!pluginsElem) {
            return;
          }
          if (ts.isArrayLiteralExpression(pluginsElem.initializer)) {
            const pluginsArray = pluginsElem.initializer;
            const plugins = parseTextToJson(
              pluginsElem.initializer
                .getText()
                .replace(SPREAD_ELEMENTS_REGEXP, '')
            );

            if (plugins.length > 1) {
              changes.push({
                type: ChangeType.Delete,
                start: pluginsArray.pos,
                length: pluginsArray.end - pluginsArray.pos,
              });
              changes.push({
                type: ChangeType.Insert,
                index: pluginsArray.pos,
                text: JSON.stringify(plugins.filter((p) => p !== pluginName)),
              });
            } else {
              const keys = element.properties.map((prop) =>
                prop.name?.getText()
              );
              if (keys.length > 1) {
                const removeComma =
                  keys.indexOf('plugins') < keys.length - 1 ||
                  element.properties.hasTrailingComma;
                changes.push({
                  type: ChangeType.Delete,
                  start: pluginsElem.pos + (removeComma ? 1 : 0),
                  length:
                    pluginsElem.end - pluginsElem.pos + (removeComma ? 1 : 0),
                });
              } else {
                const removeComma =
                  blockElements.indexOf(element) < blockElements.length - 1 ||
                  blockElements.hasTrailingComma;
                changes.push({
                  type: ChangeType.Delete,
                  start: element.pos + (removeComma ? 1 : 0),
                  length: element.end - element.pos + (removeComma ? 1 : 0),
                });
              }
            }
          } else if (ts.isObjectLiteralExpression(pluginsElem.initializer)) {
            const pluginsObj = pluginsElem.initializer;
            if (pluginsElem.initializer.properties.length > 1) {
              const plugin = pluginsObj.properties.find(
                (prop) => prop.name?.['text'] === pluginName
              ) as ts.PropertyAssignment;
              const removeComma =
                pluginsObj.properties.indexOf(plugin) <
                  pluginsObj.properties.length - 1 ||
                pluginsObj.properties.hasTrailingComma;
              changes.push({
                type: ChangeType.Delete,
                start: plugin.pos + (removeComma ? 1 : 0),
                length: plugin.end - plugin.pos + (removeComma ? 1 : 0),
              });
            } else {
              const keys = element.properties.map((prop) =>
                prop.name?.getText()
              );
              if (keys.length > 1) {
                const removeComma =
                  keys.indexOf('plugins') < keys.length - 1 ||
                  element.properties.hasTrailingComma;
                changes.push({
                  type: ChangeType.Delete,
                  start: pluginsElem.pos + (removeComma ? 1 : 0),
                  length:
                    pluginsElem.end - pluginsElem.pos + (removeComma ? 1 : 0),
                });
              } else {
                const removeComma =
                  blockElements.indexOf(element) < blockElements.length - 1 ||
                  blockElements.hasTrailingComma;
                changes.push({
                  type: ChangeType.Delete,
                  start: element.pos + (removeComma ? 1 : 0),
                  length: element.end - element.pos + (removeComma ? 1 : 0),
                });
              }
            }
          }
        }
      });
    }
  });
  return applyChangesToString(content, changes);
}

export function removeCompatExtends(
  content: string,
  compatExtends: string[]
): string {
  const source = ts.createSourceFile(
    '',
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
  );
  const changes: StringChange[] = [];
  const format = content.includes('export default') ? 'mjs' : 'cjs';
  const exportsArray =
    format === 'mjs' ? findExportDefault(source) : findModuleExports(source);

  if (!exportsArray) {
    return content;
  }

  exportsArray.forEach((node) => {
    if (
      ts.isSpreadElement(node) &&
      ts.isCallExpression(node.expression) &&
      ts.isArrowFunction(node.expression.arguments[0]) &&
      ts.isParenthesizedExpression(node.expression.arguments[0].body) &&
      ts.isPropertyAccessExpression(node.expression.expression) &&
      ts.isCallExpression(node.expression.expression.expression)
    ) {
      const callExp = node.expression.expression.expression;
      if (
        ((callExp.expression.getText() === 'compat.config' &&
          callExp.arguments[0].getText().includes('extends')) ||
          callExp.expression.getText() === 'compat.extends') &&
        compatExtends.some((ext) =>
          callExp.arguments[0].getText().includes(ext)
        )
      ) {
        // remove the whole node
        changes.push({
          type: ChangeType.Delete,
          start: node.pos,
          length: node.end - node.pos,
        });
        // and replace it with new one
        const paramName =
          node.expression.arguments[0].parameters[0].name.getText();
        const body = node.expression.arguments[0].body.expression.getFullText();
        changes.push({
          type: ChangeType.Insert,
          index: node.pos,
          text:
            '\n' +
            body.replace(
              new RegExp(
                '[ \t]s*...' + paramName + '(\\.rules)?[ \t]*,?\\s*',
                'g'
              ),
              ''
            ),
        });
      }
    }
  });

  return applyChangesToString(content, changes);
}

export function removePredefinedConfigs(
  content: string,
  moduleImport: string,
  moduleVariable: string,
  configs: string[]
): string {
  const source = ts.createSourceFile(
    '',
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
  );
  const format = content.includes('export default') ? 'mjs' : 'cjs';
  const changes: StringChange[] = [];
  let removeImport = true;
  const exportsArray =
    format === 'mjs' ? findExportDefault(source) : findModuleExports(source);
  if (!exportsArray) {
    return content;
  }

  exportsArray.forEach((node) => {
    if (
      ts.isSpreadElement(node) &&
      ts.isElementAccessExpression(node.expression) &&
      ts.isPropertyAccessExpression(node.expression.expression) &&
      ts.isIdentifier(node.expression.expression.expression) &&
      node.expression.expression.expression.getText() === moduleVariable &&
      ts.isStringLiteral(node.expression.argumentExpression)
    ) {
      const config = node.expression.argumentExpression.getText();
      // Check the text without quotes
      if (configs.includes(config.substring(1, config.length - 1))) {
        changes.push({
          type: ChangeType.Delete,
          start: node.pos,
          length: node.end - node.pos + 1, // trailing comma
        });
      } else {
        // If there is still a config used, do not remove import
        removeImport = false;
      }
    }
  });

  let updated = applyChangesToString(content, changes);
  if (removeImport) {
    updated = removeImportFromFlatConfig(updated, moduleVariable, moduleImport);
  }
  return updated;
}

/**
 * Add plugins block to the top of the export blocks
 */
export function addPluginsToExportsBlock(
  content: string,
  plugins: { name: string; varName: string; imp: string }[]
): string {
  const pluginsBlock = ts.factory.createObjectLiteralExpression(
    [
      ts.factory.createPropertyAssignment(
        'plugins',
        ts.factory.createObjectLiteralExpression(
          plugins.map(({ name, varName }) => {
            return ts.factory.createPropertyAssignment(
              ts.factory.createStringLiteral(name),
              ts.factory.createIdentifier(varName)
            );
          })
        )
      ),
    ],
    false
  );
  return addBlockToFlatConfigExport(content, pluginsBlock, {
    insertAtTheEnd: false,
  });
}

/**
 * Adds compat if missing to flat config
 */
export function addFlatCompatToFlatConfig(content: string) {
  const result = addImportToFlatConfig(content, 'js', '@eslint/js');
  const format = content.includes('export default') ? 'mjs' : 'cjs';
  if (result.includes('const compat = new FlatCompat')) {
    return result;
  }

  if (format === 'mjs') {
    return addFlatCompatToFlatConfigESM(result);
  } else {
    return addFlatCompatToFlatConfigCJS(result);
  }
}

function addFlatCompatToFlatConfigCJS(content: string) {
  content = addImportToFlatConfig(content, ['FlatCompat'], '@eslint/eslintrc');
  const index = content.indexOf('module.exports');
  return applyChangesToString(content, [
    {
      type: ChangeType.Insert,
      index: index - 1,
      text: `
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});
`,
    },
  ]);
}
function addFlatCompatToFlatConfigESM(content: string) {
  const importsToAdd = [
    { variable: 'js', module: '@eslint/js' },
    { variable: ['fileURLToPath'], module: 'url' },
    { variable: ['dirname'], module: 'path' },
    { variable: ['FlatCompat'], module: '@eslint/eslintrc' },
  ];

  for (const { variable, module } of importsToAdd) {
    content = addImportToFlatConfig(content, variable, module);
  }

  const index = content.indexOf('export default');
  return applyChangesToString(content, [
    {
      type: ChangeType.Insert,
      index: index - 1,
      text: `
const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
  recommendedConfig: js.configs.recommended,
});\n
`,
    },
  ]);
}

/**
 * Generate node list representing the imports and the exports blocks
 * Optionally add flat compat initialization
 */
export function createNodeList(
  importsMap: Map<string, string>,
  exportElements: ts.Expression[],
  format: 'mjs' | 'cjs'
): ts.NodeArray<
  ts.VariableStatement | ts.Identifier | ts.ExpressionStatement | ts.SourceFile
> {
  const importsList = [];

  Array.from(importsMap.entries()).forEach(([imp, varName]) => {
    if (format === 'mjs') {
      importsList.push(generateESMImport(varName, imp));
    } else {
      importsList.push(generateRequire(varName, imp));
    }
  });

  const exports =
    format === 'mjs'
      ? generateESMExport(exportElements)
      : generateCJSExport(exportElements);

  return ts.factory.createNodeArray([
    // add plugin imports
    ...importsList,
    ts.createSourceFile(
      '',
      '',
      ts.ScriptTarget.Latest,
      false,
      ts.ScriptKind.JS
    ),
    exports,
  ]);
}

function generateESMExport(elements: ts.Expression[]): ts.ExportAssignment {
  // creates: export default = [...]
  return ts.factory.createExportAssignment(
    undefined,
    false,
    ts.factory.createArrayLiteralExpression(elements, true)
  );
}

function generateCJSExport(elements: ts.Expression[]): ts.ExpressionStatement {
  // creates: module.exports = [...]
  return ts.factory.createExpressionStatement(
    ts.factory.createBinaryExpression(
      ts.factory.createPropertyAccessExpression(
        ts.factory.createIdentifier('module'),
        ts.factory.createIdentifier('exports')
      ),
      ts.factory.createToken(ts.SyntaxKind.EqualsToken),
      ts.factory.createArrayLiteralExpression(elements, true)
    )
  );
}

export function generateSpreadElement(name: string): ts.SpreadElement {
  return ts.factory.createSpreadElement(ts.factory.createIdentifier(name));
}

export function generatePluginExtendsElement(
  plugins: string[]
): ts.SpreadElement {
  return ts.factory.createSpreadElement(
    ts.factory.createCallExpression(
      ts.factory.createPropertyAccessExpression(
        ts.factory.createIdentifier('compat'),
        ts.factory.createIdentifier('extends')
      ),
      undefined,
      plugins.map((plugin) => ts.factory.createStringLiteral(plugin))
    )
  );
}

export function generatePluginExtendsElementWithCompatFixup(
  plugin: string
): ts.SpreadElement {
  return ts.factory.createSpreadElement(
    ts.factory.createCallExpression(
      ts.factory.createIdentifier('fixupConfigRules'),
      undefined,
      [
        ts.factory.createCallExpression(
          ts.factory.createPropertyAccessExpression(
            ts.factory.createIdentifier('compat'),
            ts.factory.createIdentifier('extends')
          ),
          undefined,
          [ts.factory.createStringLiteral(plugin)]
        ),
      ]
    )
  );
}

/**
 * Stringifies TS nodes to file content string
 */
export function stringifyNodeList(
  nodes: ts.NodeArray<
    | ts.VariableStatement
    | ts.Identifier
    | ts.ExpressionStatement
    | ts.SourceFile
  >
): string {
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const resultFile = ts.createSourceFile(
    '',
    '',
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
  );
  const result = printer
    .printList(ts.ListFormat.MultiLine, nodes, resultFile)
    // add new line before compat initialization
    .replace(
      /const compat = new FlatCompat/,
      '\nconst compat = new FlatCompat'
    );

  if (result.includes('export default')) {
    return result // add new line before export default = ...
      .replace(/export default/, '\nexport default');
  } else {
    return result.replace(/module.exports/, '\nmodule.exports');
  }
}

/**
 * generates AST require statement
 */
export function generateRequire(
  variableName: string | ts.ObjectBindingPattern,
  imp: string
): ts.VariableStatement {
  return ts.factory.createVariableStatement(
    undefined,
    ts.factory.createVariableDeclarationList(
      [
        ts.factory.createVariableDeclaration(
          variableName,
          undefined,
          undefined,
          ts.factory.createCallExpression(
            ts.factory.createIdentifier('require'),
            undefined,
            [ts.factory.createStringLiteral(imp)]
          )
        ),
      ],
      ts.NodeFlags.Const
    )
  );
}

// Top level imports
export function generateESMImport(
  variableName: string | ts.ObjectBindingPattern,
  imp: string
): ts.ImportDeclaration {
  let importClause;

  if (typeof variableName === 'string') {
    // For single variable import e.g import foo from 'module';
    importClause = ts.factory.createImportClause(
      false,
      ts.factory.createIdentifier(variableName),
      undefined
    );
  } else {
    // For object binding pattern import e.g import { a, b, c } from 'module';
    importClause = ts.factory.createImportClause(
      false,
      undefined,
      ts.factory.createNamedImports(
        variableName.elements.map((element) => {
          const propertyName = element.propertyName
            ? ts.isIdentifier(element.propertyName)
              ? element.propertyName
              : ts.factory.createIdentifier(element.propertyName.getText())
            : undefined;

          return ts.factory.createImportSpecifier(
            false,
            propertyName,
            element.name as ts.Identifier
          );
        })
      )
    );
  }

  return ts.factory.createImportDeclaration(
    undefined,
    importClause,
    ts.factory.createStringLiteral(imp)
  );
}

/**
 * FROM: https://github.com/eslint/rewrite/blob/e2a7ec809db20e638abbad250d105ddbde88a8d5/packages/migrate-config/src/migrate-config.js#L222
 *
 * Converts a glob pattern to a format that can be used in a flat config.
 * @param {string} pattern The glob pattern to convert.
 * @returns {string} The converted glob pattern.
 */
function convertGlobPattern(pattern: string): string {
  const isNegated = pattern.startsWith('!');
  const patternToTest = isNegated ? pattern.slice(1) : pattern;
  // if the pattern is already in the correct format, return it
  if (patternToTest === '**' || patternToTest.includes('/')) {
    return pattern;
  }
  return `${isNegated ? '!' : ''}**/${patternToTest}`;
}

// FROM: https://github.com/eslint/rewrite/blob/e2a7ec809db20e638abbad250d105ddbde88a8d5/packages/migrate-config/src/migrate-config.js#L38
const keysToCopy = ['settings', 'rules', 'processor'];

export function overrideNeedsCompat(
  override: Partial<Linter.ConfigOverride<Linter.RulesRecord>>
) {
  return override.env || override.extends || override.plugins;
}

/**
 * Generates an AST object or spread element representing a modern flat config entry,
 * based on a given legacy eslintrc JSON override object
 */
export function generateFlatOverride(
  _override: Partial<Linter.ConfigOverride<Linter.RulesRecord>> & {
    ignores?: Linter.FlatConfig['ignores'];
  },
  format: 'mjs' | 'cjs'
): ts.ObjectLiteralExpression | ts.SpreadElement {
  const override = mapFilePaths(_override);

  // We do not need the compat tooling for this override
  if (!overrideNeedsCompat(override)) {
    // Ensure files is an array
    let files = override.files;
    if (typeof files === 'string') {
      files = [files];
    }

    const flatConfigOverride: Linter.FlatConfig = {
      files,
    };

    if (override.ignores) {
      flatConfigOverride.ignores = override.ignores;
    }

    if (override.rules) {
      flatConfigOverride.rules = override.rules;
    }

    // Copy over everything that stays the same
    keysToCopy.forEach((key) => {
      if (override[key]) {
        flatConfigOverride[key] = override[key];
      }
    });

    if (override.parser || override.parserOptions) {
      const languageOptions = {};
      if (override.parser) {
        languageOptions['parser'] = override.parser;
      }
      if (override.parserOptions) {
        languageOptions['parserOptions'] = override.parserOptions;
      }
      if (Object.keys(languageOptions).length) {
        flatConfigOverride.languageOptions = languageOptions;
      }
    }

    if (override['languageOptions']) {
      flatConfigOverride.languageOptions = override['languageOptions'];
    }

    if (override.excludedFiles) {
      flatConfigOverride.ignores = (
        Array.isArray(override.excludedFiles)
          ? override.excludedFiles
          : [override.excludedFiles]
      ).map((p) => convertGlobPattern(p));
    }

    return generateAst(flatConfigOverride, {
      keyToMatch: /^(parser|rules)$/,
      replacer: (propertyAssignment, propertyName) => {
        if (propertyName === 'rules') {
          // Add comment that user can override rules if there are no overrides.
          if (
            ts.isObjectLiteralExpression(propertyAssignment.initializer) &&
            propertyAssignment.initializer.properties.length === 0
          ) {
            return ts.addSyntheticLeadingComment(
              ts.factory.createPropertyAssignment(
                propertyAssignment.name,
                ts.factory.createObjectLiteralExpression([])
              ),

              ts.SyntaxKind.SingleLineCommentTrivia,
              ' Override or add rules here'
            );
          }
          return propertyAssignment;
        } else {
          // Change parser to import statement.
          return format === 'mjs'
            ? generateESMParserImport(override)
            : generateCJSParserImport(override);
        }
      },
    });
  }

  // At this point we are applying the flat config compat tooling to the override
  let { excludedFiles, parser, parserOptions, rules, files, ...rest } =
    override;

  const objectLiteralElements: ts.ObjectLiteralElementLike[] = [
    ts.factory.createSpreadAssignment(ts.factory.createIdentifier('config')),
  ];

  // If converting the JS rule, then we need to match ESLint default and also include .cjs and .mjs files.
  if (
    (Array.isArray(rest.extends) &&
      rest.extends.includes('plugin:@nx/javascript')) ||
    rest.extends === 'plugin:@nx/javascript'
  ) {
    const newFiles = new Set(files);
    newFiles.add('**/*.js');
    newFiles.add('**/*.jsx');
    newFiles.add('**/*.cjs');
    newFiles.add('**/*.mjs');
    files = Array.from(newFiles);
  }
  // If converting the TS rule, then we need to match ESLint default and also include .cts and .mts files.
  if (
    (Array.isArray(rest.extends) &&
      rest.extends.includes('plugin:@nx/typescript')) ||
    rest.extends === 'plugin:@nx/typescript'
  ) {
    const newFiles = new Set(files);
    newFiles.add('**/*.ts');
    newFiles.add('**/*.tsx');
    newFiles.add('**/*.cts');
    newFiles.add('**/*.mts');
    files = Array.from(newFiles);
  }

  addTSObjectProperty(objectLiteralElements, 'files', files);
  addTSObjectProperty(objectLiteralElements, 'excludedFiles', excludedFiles);

  // Apply rules (and spread ...config.rules into it as the first assignment)
  addTSObjectProperty(objectLiteralElements, 'rules', rules || {});
  const rulesObjectAST = objectLiteralElements.pop() as ts.PropertyAssignment;
  const rulesObjectInitializer =
    rulesObjectAST.initializer as ts.ObjectLiteralExpression;
  const spreadAssignment = ts.factory.createSpreadAssignment(
    ts.factory.createIdentifier('config.rules')
  );
  const updatedRulesProperties = [
    spreadAssignment,
    ...rulesObjectInitializer.properties,
  ];
  objectLiteralElements.push(
    ts.factory.createPropertyAssignment(
      'rules',
      ts.factory.createObjectLiteralExpression(updatedRulesProperties, true)
    )
  );

  if (parserOptions) {
    addTSObjectProperty(objectLiteralElements, 'languageOptions', {
      parserOptions,
    });
  }

  return ts.factory.createSpreadElement(
    ts.factory.createCallExpression(
      ts.factory.createPropertyAccessExpression(
        ts.factory.createCallExpression(
          ts.factory.createPropertyAccessExpression(
            ts.factory.createIdentifier('compat'),
            ts.factory.createIdentifier('config')
          ),
          undefined,
          [generateAst(rest)]
        ),
        ts.factory.createIdentifier('map')
      ),
      undefined,
      [
        ts.factory.createArrowFunction(
          undefined,
          undefined,
          [
            ts.factory.createParameterDeclaration(
              undefined,
              undefined,
              'config'
            ),
          ],
          undefined,
          ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
          ts.factory.createParenthesizedExpression(
            ts.factory.createObjectLiteralExpression(
              objectLiteralElements,
              true
            )
          )
        ),
      ]
    )
  );
}

function generateESMParserImport(
  override: Partial<Linter.ConfigOverride<Linter.RulesRecord>> & {
    ignores?: Linter.FlatConfig['ignores'];
  }
): ts.PropertyAssignment {
  return ts.factory.createPropertyAssignment(
    'parser',
    ts.factory.createAwaitExpression(
      ts.factory.createCallExpression(
        ts.factory.createIdentifier('import'),
        undefined,
        [
          ts.factory.createStringLiteral(
            override['languageOptions']?.['parserOptions']?.parser ??
              override['languageOptions']?.parser ??
              override.parser
          ),
        ]
      )
    )
  );
}

function generateCJSParserImport(
  override: Partial<Linter.ConfigOverride<Linter.RulesRecord>> & {
    ignores?: Linter.FlatConfig['ignores'];
  }
): ts.PropertyAssignment {
  return ts.factory.createPropertyAssignment(
    'parser',
    ts.factory.createCallExpression(
      ts.factory.createIdentifier('require'),
      undefined,
      [
        ts.factory.createStringLiteral(
          override['languageOptions']?.['parserOptions']?.parser ??
            override['languageOptions']?.parser ??
            override.parser
        ),
      ]
    )
  );
}

export function generateFlatPredefinedConfig(
  predefinedConfigName: string,
  moduleName = 'nx',
  spread = true
): ts.ObjectLiteralExpression | ts.SpreadElement | ts.ElementAccessExpression {
  const node = ts.factory.createElementAccessExpression(
    ts.factory.createPropertyAccessExpression(
      ts.factory.createIdentifier(moduleName),
      ts.factory.createIdentifier('configs')
    ),
    ts.factory.createStringLiteral(predefinedConfigName)
  );

  return spread ? ts.factory.createSpreadElement(node) : node;
}

export function mapFilePaths<
  T extends Partial<Linter.ConfigOverride<Linter.RulesRecord>>
>(_override: T) {
  const override: T = {
    ..._override,
  };
  if (override.files) {
    override.files = Array.isArray(override.files)
      ? override.files
      : [override.files];
    override.files = override.files.map((file) => mapFilePath(file));
  }
  if (override.excludedFiles) {
    override.excludedFiles = Array.isArray(override.excludedFiles)
      ? override.excludedFiles
      : [override.excludedFiles];
    override.excludedFiles = override.excludedFiles.map((file) =>
      mapFilePath(file)
    );
  }
  return override;
}

function addTSObjectProperty(
  elements: ts.ObjectLiteralElementLike[],
  key: string,
  value: unknown
) {
  if (value) {
    elements.push(ts.factory.createPropertyAssignment(key, generateAst(value)));
  }
}

/**
 * Generates an AST from a JSON-type input
 */
export function generateAst<T>(
  input: unknown,
  propertyAssignmentReplacer?: {
    keyToMatch: RegExp | string;
    replacer: (
      propertyAssignment: ts.PropertyAssignment,
      propertyName: string
    ) => ts.PropertyAssignment;
  }
): T {
  if (Array.isArray(input)) {
    return ts.factory.createArrayLiteralExpression(
      input.map((item) =>
        generateAst<ts.Expression>(item, propertyAssignmentReplacer)
      ),
      true // Always treat as multiline, using item.length does not work in all cases
    ) as T;
  }
  if (input === null) {
    return ts.factory.createNull() as T;
  }
  if (typeof input === 'object') {
    return ts.factory.createObjectLiteralExpression(
      generatePropertyAssignmentsFromObjectEntries(
        input,
        propertyAssignmentReplacer
      ),
      true // Always treat as multiline, using  Object.keys(input).length > 1 does not work in all cases
    ) as T;
  }
  if (typeof input === 'string') {
    return ts.factory.createStringLiteral(input) as T;
  }
  if (typeof input === 'number') {
    return ts.factory.createNumericLiteral(input) as T;
  }
  if (typeof input === 'boolean') {
    return (input ? ts.factory.createTrue() : ts.factory.createFalse()) as T;
  }
  // since we are parsing JSON, this should never happen
  throw new Error(`Unknown type: ${typeof input} `);
}

function generatePropertyAssignmentsFromObjectEntries(
  input: object,
  propertyAssignmentReplacer?: {
    keyToMatch: RegExp | string;
    replacer: (
      propertyAssignment: ts.PropertyAssignment,
      propertyName: string
    ) => ts.PropertyAssignment;
  }
): ts.PropertyAssignment[] {
  return Object.entries(input)
    .filter(([_, value]) => value !== undefined)
    .map(([key, value]) => {
      const original = ts.factory.createPropertyAssignment(
        isValidKey(key) ? key : ts.factory.createStringLiteral(key),
        generateAst<ts.Expression>(value, propertyAssignmentReplacer)
      );
      if (
        propertyAssignmentReplacer &&
        (typeof propertyAssignmentReplacer.keyToMatch === 'string'
          ? key === propertyAssignmentReplacer.keyToMatch
          : propertyAssignmentReplacer.keyToMatch.test(key))
      ) {
        return propertyAssignmentReplacer.replacer(original, key);
      }
      return original;
    });
}

function isValidKey(key: string): boolean {
  return /^[a-zA-Z0-9_]+$/.test(key);
}
