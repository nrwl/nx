import {
  ChangeType,
  applyChangesToString,
  joinPathFragments,
} from '@nx/devkit';
import { Linter } from 'eslint';
import * as ts from 'typescript';

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

  const foundImportVars: ts.NodeArray<ts.BindingElement> = ts.forEachChild(
    source,
    function analyze(node) {
      // we can only combine object binding patterns
      if (!Array.isArray(variable)) {
        return;
      }
      if (
        ts.isVariableStatement(node) &&
        node.declarationList.declarations.length > 0 &&
        ts.isVariableDeclaration(node.declarationList.declarations[0]) &&
        ts.isObjectBindingPattern(node.declarationList.declarations[0].name) &&
        ts.isCallExpression(node.declarationList.declarations[0].initializer) &&
        node.declarationList.declarations[0].initializer.expression.getText() ===
          'require' &&
        node.declarationList.declarations[0].initializer.arguments.length ===
          1 &&
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

  if (foundImportVars && Array.isArray(variable)) {
    const newVariables = variable.filter(
      (v) => !foundImportVars.some((fv) => v === fv.name.getText())
    );
    if (newVariables.length === 0) {
      return content;
    }
    const isMultiLine = foundImportVars.hasTrailingComma;
    const pos = foundImportVars.end;
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
  } else {
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
}

/**
 * Injects new ts.expression to the end of the module.exports array.
 */
export function addConfigToFlatConfigExport(
  content: string,
  config: ts.Expression | ts.SpreadElement,
  options: { insertAtTheEnd: boolean } = { insertAtTheEnd: true }
): string {
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const source = ts.createSourceFile(
    '',
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
  );

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
  const insert = printer.printNode(ts.EmitHint.Expression, config, source);
  if (options.insertAtTheEnd) {
    return applyChangesToString(content, [
      {
        type: ChangeType.Insert,
        index: exportsArray[exportsArray.length - 1].end,
        text: `,\n${insert}`,
      },
    ]);
  } else {
    return applyChangesToString(content, [
      {
        type: ChangeType.Insert,
        index: exportsArray[0].pos,
        text: `\n${insert},`,
      },
    ]);
  }
}

const DEFAULT_FLAT_CONFIG = `
const compat = new FlatCompat({
      baseDirectory: __dirname,
      recommendedConfig: js.configs.recommended,
    });
  `;

export function createNodeList(
  importsMap: Map<string, string>,
  exportElements: ts.Expression[],
  isFlatCompatNeeded: boolean
): ts.NodeArray<
  ts.VariableStatement | ts.Identifier | ts.ExpressionStatement | ts.SourceFile
> {
  const importsList = [];
  if (isFlatCompatNeeded) {
    importsMap.set('@eslint/js', 'js');

    importsList.push(
      generateRequire(
        ts.factory.createObjectBindingPattern([
          ts.factory.createBindingElement(undefined, undefined, 'FlatCompat'),
        ]),
        '@eslint/eslintrc'
      )
    );
  }

  // generateRequire(varName, imp, ts.factory);
  Array.from(importsMap.entries()).forEach(([imp, varName]) => {
    importsList.push(generateRequire(varName, imp));
  });

  return ts.factory.createNodeArray([
    // add plugin imports
    ...importsList,
    ts.createSourceFile(
      '',
      isFlatCompatNeeded ? DEFAULT_FLAT_CONFIG : '',
      ts.ScriptTarget.Latest,
      false,
      ts.ScriptKind.JS
    ),
    // creates:
    // module.exports = [ ... ];
    ts.factory.createExpressionStatement(
      ts.factory.createBinaryExpression(
        ts.factory.createPropertyAccessExpression(
          ts.factory.createIdentifier('module'),
          ts.factory.createIdentifier('exports')
        ),
        ts.factory.createToken(ts.SyntaxKind.EqualsToken),
        ts.factory.createArrayLiteralExpression(exportElements, true)
      )
    ),
  ]);
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

/**
 * Stringifies TS nodes to file content string
 */
export function stringifyNodeList(
  nodes: ts.NodeArray<
    | ts.VariableStatement
    | ts.Identifier
    | ts.ExpressionStatement
    | ts.SourceFile
  >,
  root: string,
  fileName: string
): string {
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const resultFile = ts.createSourceFile(
    joinPathFragments(root, fileName),
    '',
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
  );
  return printer.printList(ts.ListFormat.MultiLine, nodes, resultFile);
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

/**
 * Generates AST object or spread element based on JSON override object
 */
export function generateFlatOverride(
  override: Linter.ConfigOverride<Linter.RulesRecord>,
  root: string
): ts.ObjectLiteralExpression | ts.SpreadElement {
  mapFilePaths(override, root);
  if (
    !override.env &&
    !override.extends &&
    !override.plugins &&
    !override.parser
  ) {
    return generateAst(override);
  }
  const { files, excludedFiles, rules, ...rest } = override;

  const objectLiteralElements: ts.ObjectLiteralElementLike[] = [
    ts.factory.createSpreadAssignment(ts.factory.createIdentifier('config')),
  ];
  addTSObjectProperty(objectLiteralElements, 'files', files);
  addTSObjectProperty(objectLiteralElements, 'excludedFiles', excludedFiles);
  addTSObjectProperty(objectLiteralElements, 'rules', rules);

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

function mapFilePaths(
  override: Linter.ConfigOverride<Linter.RulesRecord>,
  root: string
) {
  if (override.files) {
    override.files = Array.isArray(override.files)
      ? override.files
      : [override.files];
    override.files = override.files.map((file) => mapFilePath(file, root));
  }
  if (override.excludedFiles) {
    override.excludedFiles = Array.isArray(override.excludedFiles)
      ? override.excludedFiles
      : [override.excludedFiles];
    override.excludedFiles = override.excludedFiles.map((file) =>
      mapFilePath(file, root)
    );
  }
}

export function mapFilePath(filePath: string, root: string) {
  if (filePath.startsWith('!')) {
    const fileWithoutBang = filePath.slice(1);
    if (fileWithoutBang.startsWith('*.')) {
      return `!${joinPathFragments(root, '**', fileWithoutBang)}`;
    } else {
      return `!${joinPathFragments(root, fileWithoutBang)}`;
    }
  }
  if (filePath.startsWith('*.')) {
    return joinPathFragments(root, '**', filePath);
  } else {
    return joinPathFragments(root, filePath);
  }
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
export function generateAst<T>(input: unknown): T {
  if (Array.isArray(input)) {
    return ts.factory.createArrayLiteralExpression(
      input.map((item) => generateAst<ts.Expression>(item)),
      input.length > 1 // multiline only if more than one item
    ) as T;
  }
  if (input === null) {
    return ts.factory.createNull() as T;
  }
  if (typeof input === 'object') {
    return ts.factory.createObjectLiteralExpression(
      Object.entries(input)
        .filter(([_, value]) => value !== undefined)
        .map(([key, value]) =>
          ts.factory.createPropertyAssignment(
            isValidKey(key) ? key : ts.factory.createStringLiteral(key),
            generateAst<ts.Expression>(value)
          )
        ),
      Object.keys(input).length > 1 // multiline only if more than one property
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

function isValidKey(key: string): boolean {
  return /^[a-zA-Z0-9_]+$/.test(key);
}
