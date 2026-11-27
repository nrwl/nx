import { join } from 'path';
import type * as ts from 'typescript';
import { workspaceRoot } from '../../../utils/workspace-root';
import {
  getTypescriptBackend,
  unhandledTypescriptBackend,
  withTypescriptApi,
  type ApiTypescriptBackend,
  type ClassicTypescriptBackend,
  type TypescriptAstGuardsModule,
} from './typescript-backend';
import {
  createTypescriptPrinter,
  recordUpdateOrigin,
  type TypescriptPrinter,
} from './typescript-printer';

/** @ts-ignore resolves only when `typescript` is >= 7.1 */
type ApiDiagnostic = import('typescript/sync').Diagnostic;
/** @ts-ignore resolves only when `typescript` is >= 7.1 */
type ApiProgram = import('typescript/sync').Program;

// TypeScript 6 guards that TypeScript 7.1 exports under another name.
type RenamedNodeGuard =
  | 'isFunctionLike'
  | 'isMethodSignature'
  | 'isParameter'
  | 'isPropertySignature'
  | 'isStringLiteralLike'
  | 'isTypeAssertionExpression';

// TypeScript 6 kinds TypeScript 7.1 does not have. 7.1 names `EndOfFileToken`
// `EndOfFile`, and the adapter aliases it.
type AbsentSyntaxKind =
  | 'AssertClause'
  | 'AssertEntry'
  | 'Bundle'
  | 'CommaListExpression'
  | 'ImportTypeAssertionContainer'
  | 'JSDocAuthorTag'
  | 'JSDocClassTag'
  | 'JSDocComment'
  | 'JSDocEnumTag'
  | 'JSDocFunctionType'
  | 'JSDocMemberName'
  | 'JSDocNamepathType'
  | 'JSDocTag'
  | 'JSDocUnknownType'
  | 'ShebangTrivia';

// The node builders both versions have, with TypeScript 6's signatures.
type TypescriptFactory = Pick<
  ts.NodeFactory,
  | 'createArrayLiteralExpression'
  | 'createArrowFunction'
  | 'createAwaitExpression'
  | 'createBinaryExpression'
  | 'createBindingElement'
  | 'createCallExpression'
  | 'createElementAccessChain'
  | 'createElementAccessExpression'
  | 'createExportAssignment'
  | 'createExpressionStatement'
  | 'createFalse'
  | 'createIdentifier'
  | 'createImportClause'
  | 'createImportDeclaration'
  | 'createImportSpecifier'
  | 'createMetaProperty'
  | 'createNamedImports'
  | 'createNull'
  | 'createObjectBindingPattern'
  | 'createObjectLiteralExpression'
  | 'createParameterDeclaration'
  | 'createParenthesizedExpression'
  | 'createPrefixUnaryExpression'
  | 'createPropertyAccessChain'
  | 'createPropertyAccessExpression'
  | 'createPropertyAssignment'
  | 'createSpreadAssignment'
  | 'createSpreadElement'
  | 'createStringLiteral'
  | 'createToken'
  | 'createTrue'
  | 'createVariableDeclaration'
  | 'createVariableDeclarationList'
  | 'createVariableStatement'
  | 'updateArrayLiteralExpression'
  | 'updateCallExpression'
  | 'updateImportDeclaration'
  | 'updateNamedImports'
  | 'updateNewExpression'
  | 'updateObjectLiteralExpression'
> & {
  // TypeScript 7.1 takes positions after the elements, not a trailing comma.
  createNodeArray<T extends ts.Node>(elements?: readonly T[]): ts.NodeArray<T>;
  // TypeScript 7.1's token flags have other values.
  createNumericLiteral(value: string | number): ts.NumericLiteral;
};

// Guards both versions export that answer differently for some nodes.
const divergentNodeGuards = [
  'isCallLikeExpression',
  'isConciseBody',
  'isDeclarationName',
  'isDestructuringAssignment',
  'isExpression',
  'isForInitializer',
  'isLiteralExpression',
  'isLiteralTypeLiteral',
  'isModuleBody',
  'isPropertyName',
  'isPropertyNameLiteral',
  'isStatement',
  'isTypeNode',
  'isValidTypeOnlyAliasUseSite',
] as const;

/**
 * The part of the TypeScript module that parses and reads source code, from
 * the workspace's TypeScript. Node kinds differ between TypeScript versions,
 * so compare them only with this object's `SyntaxKind`.
 *
 * Trees match TypeScript 6's, except that TypeScript 7.1 parses an array
 * binding hole as a `BindingElement`, interface `extends` and class
 * `implements` types as `TypeReference`s, and gives the inner declaration of
 * `namespace A.B` an `export` modifier.
 *
 * Print nodes built with `factory` through {@link printNode}.
 */
export type TypescriptAst = Pick<
  typeof ts,
  | 'canHaveModifiers'
  | 'createSourceFile'
  | 'forEachChild'
  | 'getJSDocTags'
  | 'getLeadingCommentRanges'
  | 'getModifiers'
  | 'getTrailingCommentRanges'
  | 'LanguageVariant'
  | 'ScriptKind'
  | 'ScriptTarget'
  | RenamedNodeGuard
  | Exclude<
      Extract<keyof typeof ts & keyof TypescriptAstGuardsModule, `is${string}`>,
      (typeof divergentNodeGuards)[number]
    >
> & {
  // TypeScript 7.1's scanner takes no error callback.
  createScanner(
    languageVersion: ts.ScriptTarget,
    skipTrivia: boolean,
    languageVariant?: ts.LanguageVariant,
    textInitial?: string,
    onError?: undefined,
    start?: number,
    length?: number
  ): TypescriptScanner;
  factory: TypescriptFactory;
  NodeFlags: Pick<typeof ts.NodeFlags, 'BlockScoped' | 'Const'>;
  SymbolFlags: Pick<typeof ts.SymbolFlags, 'Alias' | 'Value'>;
  SyntaxKind: Omit<typeof ts.SyntaxKind, AbsentSyntaxKind>;
};

// The scanner members TypeScript 7.1 also has.
type TypescriptScanner = Omit<
  ts.Scanner,
  | 'getStartPos'
  | 'getTextPos'
  | 'getTokenPos'
  | 'setJSDocParsingMode'
  | 'setOnError'
  | 'setScriptKind'
  | 'setScriptTarget'
  | 'setTextPos'
>;

const astByPackageJsonPath = new Map<string, TypescriptAst>();

/**
 * Returns {@link TypescriptAst} for the workspace's TypeScript: the TypeScript
 * module itself before 7, and the same members over the 7.1 API from 7.1 on.
 */
export function getTypescriptAst(): TypescriptAst {
  const backend = getTypescriptBackend();
  switch (backend.kind) {
    case 'classic':
      return backend.ts;
    case 'api': {
      let ast = astByPackageJsonPath.get(backend.packageJsonPath);
      if (!ast) {
        ast = createApiAst(backend);
        astByPackageJsonPath.set(backend.packageJsonPath, ast);
      }
      return ast;
    }
    default:
      return unhandledTypescriptBackend(backend);
  }
}

/**
 * Whether parsing `sourceFile`, from {@link getTypescriptAst}, reported a
 * syntax error. The parser recovers from syntax errors, so the tree of such a
 * file is a guess.
 */
export function hasParseErrors(sourceFile: ts.SourceFile): boolean {
  const backend = getTypescriptBackend();
  switch (backend.kind) {
    case 'classic':
      return !!(sourceFile as { parseDiagnostics?: readonly unknown[] })
        .parseDiagnostics?.length;
    case 'api':
      return hasApiParseErrors(backend, sourceFile);
    default:
      return unhandledTypescriptBackend(backend);
  }
}

const printerByPackageJsonPath = new Map<string, TypescriptPrinter>();

function getTypescriptPrinter(): TypescriptPrinter {
  const backend = getTypescriptBackend();
  let printer = printerByPackageJsonPath.get(backend.packageJsonPath);
  if (!printer) {
    printer = createTypescriptPrinter(backend, {
      ast: getTypescriptAst(),
      hasParseErrors,
    });
    printerByPackageJsonPath.set(backend.packageJsonPath, printer);
  }
  return printer;
}

/**
 * Prints a node built with {@link TypescriptAst}'s `factory`, with the
 * comments {@link addSyntheticLeadingComment} put on it. Throws for a node
 * that holds parsed code, which TypeScript 7.1 reprints without its comments:
 * use {@link printNodeUpdate} for an edit of parsed code.
 */
export function printNode(node: ts.Node): string {
  assertBuiltNode(node);
  return getTypescriptPrinter().printBuiltNode(node);
}

export type PrintListFormat =
  | 'namedImportsOrExportsElements'
  | 'objectBindingPatternElements'
  | 'multiLine';

/**
 * Prints built nodes the way TypeScript 6's `printer.printList` prints them
 * for the matching `ListFormat`. In `multiLine`, an empty source file among
 * the nodes prints nothing, as it does there.
 */
export function printList(
  format: PrintListFormat,
  nodes: readonly ts.Node[]
): string {
  const printer = getTypescriptPrinter();
  switch (format) {
    case 'namedImportsOrExportsElements':
    case 'objectBindingPatternElements': {
      const printed = nodes.map((node) => {
        assertBuiltNode(node);
        return printer.printBuiltNode(node);
      });
      return printed.length > 0 ? ` ${printed.join(', ')} ` : '';
    }
    case 'multiLine':
      return nodes
        .map((node) => {
          if (isEmptySourceFile(node)) return '';
          assertBuiltNode(node);
          return `${printer.printBuiltNode(node)}\n`;
        })
        .join('');
    default:
      return unhandledPrintListFormat(format);
  }
}

function unhandledPrintListFormat(format: never): never {
  throw new Error(`Unhandled list format: ${String(format)}`);
}

function isEmptySourceFile(node: ts.Node): boolean {
  return (
    node.kind === getTypescriptAst().SyntaxKind.SourceFile &&
    (node as ts.SourceFile).text === '' &&
    (node as ts.SourceFile).statements.length === 0
  );
}

/**
 * The text for `[original.getStart(), original.end)` after the edit that
 * turned the parsed node `original` into `updated`, built from it with
 * `factory.update*` or `factory.create*`. Parsed code keeps its text,
 * comments and layout. Supports the edits Nx's generators and migrations make
 * and throws `Unsupported node update: ...` for every other.
 */
export function printNodeUpdate(original: ts.Node, updated: ts.Node): string {
  return getTypescriptPrinter().printNodeUpdate(original, updated);
}

/**
 * Stands in for `ts.addSyntheticLeadingComment`, which TypeScript 7.1 lacks.
 * Pass the adapter's `SyntaxKind.SingleLineCommentTrivia`. The comment prints
 * on its own line above `node`, which has to be an element of a built
 * multi-line object or array literal.
 */
export function addSyntheticLeadingComment<T extends ts.Node>(
  node: T,
  kind: ts.SyntaxKind,
  text: string,
  hasTrailingNewLine?: boolean
): T {
  return getTypescriptPrinter().addSyntheticLeadingComment(
    node,
    kind,
    text,
    hasTrailingNewLine
  );
}

// Built nodes have no position in a source file.
function assertBuiltNode(node: ts.Node): void {
  if (node.pos >= 0) {
    throw new Error(
      'printNode only prints nodes built with the TypeScript factory, but the node holds code parsed from a file. Insert the printed nodes into the file text instead.'
    );
  }
  getTypescriptAst().forEachChild(node, assertBuiltNode, (children) =>
    children.forEach(assertBuiltNode)
  );
}

// A TypeScript 7.1 source file carries no parse diagnostics, and some syntax
// errors, such as an unclosed JSX element, mark no node. A program holding only
// the file reports them.
function hasApiParseErrors(
  backend: ApiTypescriptBackend,
  sourceFile: ts.SourceFile
): boolean {
  const fileName = join(
    workspaceRoot,
    (sourceFile.languageVariant as number) === backend.ast.LanguageVariant.JSX
      ? '.nx-parse-check.tsx'
      : '.nx-parse-check.ts'
  );
  return withSingleFileProgram(
    backend,
    fileName,
    sourceFile.text,
    (program) => program.getSyntacticDiagnostics(fileName).length > 0
  );
}

// A program of the one file `filePath` holding `content`, with no lib files or
// imports loaded.
function withSingleFileProgram<T>(
  backend: ApiTypescriptBackend,
  filePath: string,
  content: string,
  read: (program: ApiProgram) => T
): T {
  return withTypescriptApi(backend, (api) => {
    const snapshot = api.createSnapshot({
      fileSystem: { kind: 'layer', files: { [filePath]: content } },
      createPrograms: [
        { rootFiles: [filePath], compilerOptions: singleFileCompilerOptions },
      ],
    });
    try {
      return read(snapshot.operation.createdPrograms[0]);
    } finally {
      snapshot.dispose();
    }
  });
}

const singleFileCompilerOptions = {
  noLib: true,
  noResolve: true,
  allowJs: true,
  types: [],
};

export interface SourceFileSymbol {
  readonly name: string;
  readonly declarations?: readonly ts.Node[];
  readonly valueDeclaration?: ts.Node;
}

export interface SourceFileChecker {
  getSymbolAtLocation(node: ts.Node): SourceFileSymbol | undefined;
  getShorthandAssignmentValueSymbol(
    node: ts.Node
  ): SourceFileSymbol | undefined;
  /** `meaning` takes {@link TypescriptAst}'s `SymbolFlags`. */
  getSymbolsInScope(
    location: ts.Node,
    meaning: ts.SymbolFlags
  ): SourceFileSymbol[];
}

type ReadSourceFile<T> = (
  sourceFile: ts.SourceFile,
  checker: SourceFileChecker
) => T;

/**
 * Type-checks `content` as a program of one file and passes the file and its
 * checker to `read`. `fileName` is workspace-relative, and its extension picks
 * how `content` is parsed. No lib files or imports are loaded, so a global name
 * has no symbol and an imported name resolves to its import.
 *
 * Within one call, every lookup of a symbol returns the same object, and its
 * declarations are nodes of the file passed to `read`. The checker must not be
 * used after `read` returns.
 */
export function withSourceFileChecker<T>(
  fileName: string,
  content: string,
  read: ReadSourceFile<T>
): T {
  const backend = getTypescriptBackend();
  switch (backend.kind) {
    case 'classic':
      return checkWithClassicTypescript(backend, fileName, content, read);
    case 'api':
      return checkWithTypescriptApi(backend, fileName, content, read);
    default:
      return unhandledTypescriptBackend(backend);
  }
}

function checkWithClassicTypescript<T>(
  { ts }: ClassicTypescriptBackend,
  fileName: string,
  content: string,
  read: ReadSourceFile<T>
): T {
  const sourceFile = ts.createSourceFile(
    fileName,
    content,
    ts.ScriptTarget.Latest,
    true
  );
  const program = ts.createProgram([fileName], singleFileCompilerOptions, {
    getSourceFile: (name) => (name === fileName ? sourceFile : undefined),
    getDefaultLibFileName: () => 'lib.d.ts',
    writeFile: () => {},
    getCurrentDirectory: () => '',
    getCanonicalFileName: (name) => name,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => '\n',
    fileExists: (name) => name === fileName,
    readFile: (name) => (name === fileName ? content : undefined),
  });
  return read(sourceFile, program.getTypeChecker());
}

interface ApiSymbol {
  name: string;
  declarations: readonly { resolve(): unknown }[];
  valueDeclaration: { resolve(): unknown } | undefined;
}

function checkWithTypescriptApi<T>(
  backend: ApiTypescriptBackend,
  fileName: string,
  content: string,
  read: ReadSourceFile<T>
): T {
  // A JS file is checked as TSX for the tree TypeScript 6 produces, as in
  // `createSourceFile`.
  const filePath = join(
    workspaceRoot,
    jsFilePattern.test(fileName) ? `${fileName}.tsx` : fileName
  );
  return withSingleFileProgram(backend, filePath, content, (program) => {
    const { checker } = program.getProject();
    // The API returns the same symbol object for every lookup, but its
    // declarations are handles, so each symbol gets one resolved copy.
    const symbols = new Map<ApiSymbol, SourceFileSymbol>();
    const toSymbol = (
      symbol: ApiSymbol | undefined
    ): SourceFileSymbol | undefined => {
      if (!symbol) {
        return undefined;
      }
      let resolved = symbols.get(symbol);
      if (!resolved) {
        resolved = {
          name: symbol.name,
          declarations: symbol.declarations.map(
            (declaration) => declaration.resolve() as ts.Node
          ),
          valueDeclaration: symbol.valueDeclaration?.resolve() as
            | ts.Node
            | undefined,
        };
        symbols.set(symbol, resolved);
      }
      return resolved;
    };

    const sourceFile = program.getSourceFile(filePath);
    keepByteOrderMark(sourceFile, content);
    return read(sourceFile as unknown as ts.SourceFile, {
      getSymbolAtLocation: (node) =>
        toSymbol(checker.getSymbolAtLocation(node as never)),
      getShorthandAssignmentValueSymbol: (node) =>
        toSymbol(checker.getShorthandAssignmentValueSymbol(node as never)),
      getSymbolsInScope: (location, meaning) =>
        checker
          .getSymbolsInScope(location as never, meaning as never)
          .map((symbol) => toSymbol(symbol)),
    });
  });
}

const jsFilePattern = /\.[cm]?jsx?$/i;

// TypeScript 7.1 drops a leading BOM from the text but still counts it in
// positions.
function keepByteOrderMark(sourceFile: { text: string }, text: string): void {
  if (text.charCodeAt(0) === 0xfeff) {
    Object.defineProperty(sourceFile, 'text', { value: text });
  }
}

function createApiAst(backend: ApiTypescriptBackend): TypescriptAst {
  const { ast, astGuards } = backend;
  const divergent = new Set<string>(divergentNodeGuards);
  const sharedGuards = Object.fromEntries(
    Object.entries(astGuards).filter(([name]) => !divergent.has(name))
  );
  const { NodeFlags, ScriptKind, SyntaxKind, TokenFlags } = ast;
  // The kinds TypeScript 6's `isFunctionLike` adds to function declarations.
  const signatureKinds = new Set<number>(
    [
      'CallSignature',
      'ConstructSignature',
      'ConstructorType',
      'FunctionType',
      'IndexSignature',
      'JSDocFunctionType',
      'JSDocSignature',
      'MethodSignature',
    ]
      .map((name) => SyntaxKind[name as keyof typeof SyntaxKind])
      .filter((kind) => kind !== undefined)
  );
  // The kinds TypeScript 6's `canHaveModifiers` accepts.
  const modifiableKinds = new Set<number>(
    [
      'TypeParameter',
      'Parameter',
      'PropertySignature',
      'PropertyDeclaration',
      'MethodSignature',
      'MethodDeclaration',
      'Constructor',
      'GetAccessor',
      'SetAccessor',
      'IndexSignature',
      'ConstructorType',
      'FunctionExpression',
      'ArrowFunction',
      'ClassExpression',
      'VariableStatement',
      'FunctionDeclaration',
      'ClassDeclaration',
      'InterfaceDeclaration',
      'TypeAliasDeclaration',
      'EnumDeclaration',
      'ModuleDeclaration',
      'ImportEqualsDeclaration',
      'ImportDeclaration',
      'ExportAssignment',
      'ExportDeclaration',
    ].map((name) => SyntaxKind[name as keyof typeof SyntaxKind])
  );
  const canHaveModifiers = (node: { kind: number }) =>
    modifiableKinds.has(node.kind);

  const createSourceFile = (
    fileName: string,
    sourceText: string,
    _languageVersion: unknown,
    _setParentNodes?: boolean,
    scriptKind?: number
  ) => {
    // TypeScript 7.1 turns JSDoc types in JS files into nodes (casts,
    // `@satisfies`, `@import`, `@typedef`); TypeScript 6 keeps them as
    // comments. A JS file parsed as TSX gets TypeScript 6's tree.
    const kind =
      scriptKind === ScriptKind.JS || scriptKind === ScriptKind.JSX
        ? ScriptKind.TSX
        : scriptKind || (jsFilePattern.test(fileName) ? ScriptKind.TSX : 0);
    const sourceFile = withTypescriptApi(backend, (api) => {
      const retained = api.createSourceFile(
        // TypeScript 7.1 rejects an empty file name, which TypeScript 6 parses
        // as TS.
        fileName || 'source.ts',
        sourceText,
        kind ? { scriptKind: kind } : undefined
      );
      // The nodes stay readable after the remote copy is released.
      retained.dispose();
      return retained.sourceFile;
    });
    keepByteOrderMark(sourceFile, sourceText);
    return sourceFile;
  };

  const f = backend.factory;
  // TypeScript 6 builders also take a name as a string.
  const asIdentifier = (name: unknown) =>
    (typeof name === 'string' ? f.createIdentifier(name) : name) as never;
  // TypeScript 6 element access builders also take the index as a number.
  const asExpression = (index: unknown) =>
    (typeof index === 'number'
      ? f.createNumericLiteral(String(index), TokenFlags.None)
      : index) as never;
  const recordingOrigin =
    <A extends unknown[]>(update: (node: never, ...args: A) => unknown) =>
    (node: never, ...args: A) => {
      const updated = update(node, ...args);
      recordUpdateOrigin(updated as ts.Node, node);
      return updated;
    };
  const factory = {
    createArrayLiteralExpression: (elements?: never[], multiLine?: boolean) =>
      f.createArrayLiteralExpression(elements ?? [], multiLine),
    createArrowFunction: f.createArrowFunction,
    createAwaitExpression: f.createAwaitExpression,
    createBinaryExpression: (left: never, operator: unknown, right: never) =>
      f.createBinaryExpression(
        undefined,
        left,
        undefined,
        (typeof operator === 'number'
          ? f.createToken(operator as never)
          : operator) as never,
        right
      ),
    createBindingElement: (
      dotDotDotToken: never,
      propertyName: unknown,
      name: unknown,
      initializer?: never
    ) =>
      f.createBindingElement(
        dotDotDotToken,
        asIdentifier(propertyName),
        asIdentifier(name),
        initializer
      ),
    createCallExpression: (
      expression: never,
      typeArguments: never,
      args?: never[]
    ) =>
      f.createCallExpression(
        expression,
        undefined,
        typeArguments,
        args ?? [],
        NodeFlags.None
      ),
    createElementAccessChain: (
      expression: never,
      questionDotToken: never,
      index: unknown
    ) =>
      f.createElementAccessExpression(
        expression,
        questionDotToken,
        asExpression(index),
        NodeFlags.OptionalChain
      ),
    createElementAccessExpression: (expression: never, index: unknown) =>
      f.createElementAccessExpression(
        expression,
        undefined,
        asExpression(index),
        NodeFlags.None
      ),
    createExportAssignment: (
      modifiers: never,
      isExportEquals: boolean | undefined,
      expression: never
    ) =>
      f.createExportAssignment(
        modifiers,
        isExportEquals,
        undefined,
        expression
      ),
    createExpressionStatement: f.createExpressionStatement,
    createFalse: () => f.createKeywordExpression(SyntaxKind.FalseKeyword),
    createIdentifier: f.createIdentifier,
    createImportClause: f.createImportClause,
    createImportDeclaration: f.createImportDeclaration,
    createImportSpecifier: f.createImportSpecifier,
    createMetaProperty: f.createMetaProperty,
    createNamedImports: f.createNamedImports,
    createNodeArray: (elements?: never[]) => f.createNodeArray(elements ?? []),
    createNull: () => f.createKeywordExpression(SyntaxKind.NullKeyword),
    createNumericLiteral: (value: string | number) =>
      f.createNumericLiteral(String(value), TokenFlags.None),
    createObjectBindingPattern: f.createObjectBindingPattern,
    createObjectLiteralExpression: (
      properties?: never[],
      multiLine?: boolean
    ) => f.createObjectLiteralExpression(properties ?? [], multiLine),
    createParameterDeclaration: (
      modifiers: never,
      dotDotDotToken: never,
      name: unknown,
      questionToken?: never,
      type?: never,
      initializer?: never
    ) =>
      f.createParameterDeclaration(
        modifiers,
        dotDotDotToken,
        asIdentifier(name),
        questionToken,
        type,
        initializer
      ),
    createParenthesizedExpression: f.createParenthesizedExpression,
    createPrefixUnaryExpression: f.createPrefixUnaryExpression,
    createPropertyAccessChain: (
      expression: never,
      questionDotToken: never,
      name: unknown
    ) =>
      f.createPropertyAccessExpression(
        expression,
        questionDotToken,
        asIdentifier(name),
        NodeFlags.OptionalChain
      ),
    createPropertyAccessExpression: (expression: never, name: unknown) =>
      f.createPropertyAccessExpression(
        expression,
        undefined,
        asIdentifier(name),
        NodeFlags.None
      ),
    createPropertyAssignment: (name: unknown, initializer: never) =>
      f.createPropertyAssignment(
        undefined,
        asIdentifier(name),
        undefined,
        undefined,
        initializer
      ),
    createSpreadAssignment: f.createSpreadAssignment,
    createSpreadElement: f.createSpreadElement,
    createStringLiteral: (text: string, isSingleQuote?: boolean) =>
      f.createStringLiteral(
        text,
        isSingleQuote ? TokenFlags.SingleQuote : TokenFlags.None
      ),
    createToken: f.createToken,
    createTrue: () => f.createKeywordExpression(SyntaxKind.TrueKeyword),
    createVariableDeclaration: (
      name: unknown,
      exclamationToken?: never,
      type?: never,
      initializer?: never
    ) =>
      f.createVariableDeclaration(
        asIdentifier(name),
        exclamationToken,
        type,
        initializer
      ),
    createVariableDeclarationList: (declarations: never[], flags?: number) =>
      f.createVariableDeclarationList(
        declarations,
        (flags ?? NodeFlags.None) as never
      ),
    createVariableStatement: f.createVariableStatement,
    updateArrayLiteralExpression: recordingOrigin(
      f.updateArrayLiteralExpression
    ),
    updateCallExpression: recordingOrigin(
      (
        node: { questionDotToken?: unknown },
        expression: never,
        typeArguments: never,
        args: never[]
      ) =>
        f.updateCallExpression(
          node as never,
          expression,
          node.questionDotToken as never,
          typeArguments,
          args
        )
    ),
    updateImportDeclaration: recordingOrigin(f.updateImportDeclaration),
    updateNamedImports: recordingOrigin(f.updateNamedImports),
    updateNewExpression: recordingOrigin(f.updateNewExpression),
    updateObjectLiteralExpression: recordingOrigin(
      f.updateObjectLiteralExpression
    ),
  };

  // 7.1 nodes have TypeScript 6's shape for what Nx reads, but not its
  // declared types.
  return {
    ...sharedGuards,
    isFunctionLike: (node: { kind: number } | undefined) =>
      node !== undefined &&
      (astGuards.isFunctionLikeDeclaration(node as never) ||
        signatureKinds.has(node.kind)),
    isMethodSignature: astGuards.isMethodSignatureDeclaration,
    isParameter: astGuards.isParameterDeclaration,
    isPropertySignature: astGuards.isPropertySignatureDeclaration,
    isStringLiteralLike: astGuards.isStringLiteralLikeNode,
    isTypeAssertionExpression: astGuards.isTypeAssertion,
    canHaveModifiers,
    createScanner: (
      _languageVersion: unknown,
      skipTrivia: boolean,
      languageVariant?: number,
      textInitial?: string,
      _onError?: undefined,
      start?: number,
      length?: number
    ) =>
      ast.createScanner(
        skipTrivia,
        languageVariant,
        textInitial,
        start,
        length
      ),
    createSourceFile,
    forEachChild: (
      node: { forEachChild: (...args: unknown[]) => unknown },
      cbNode: unknown,
      cbNodes?: unknown
    ) => node.forEachChild(cbNode, cbNodes),
    getModifiers: (node: {
      kind: number;
      modifiers?: readonly { kind: number }[];
    }) => {
      if (!canHaveModifiers(node)) {
        return undefined;
      }
      const modifiers = node.modifiers?.filter((modifier) =>
        astGuards.isModifier(modifier as never)
      );
      return modifiers?.length ? modifiers : undefined;
    },
    factory,
    getJSDocTags: ast.getJSDocTags,
    getLeadingCommentRanges: ast.getLeadingCommentRanges,
    getTrailingCommentRanges: ast.getTrailingCommentRanges,
    LanguageVariant: ast.LanguageVariant,
    NodeFlags,
    ScriptKind,
    ScriptTarget: ast.ScriptTarget,
    SymbolFlags: backend.sync.SymbolFlags,
    SyntaxKind: { ...SyntaxKind, EndOfFileToken: SyntaxKind.EndOfFile },
  } as unknown as TypescriptAst;
}

/**
 * The syntax errors TypeScript reports for `content` as the workspace file
 * `fileName`, as `transpileModule` reports them: a JS file also reports
 * TypeScript-only syntax. Each message is on one line.
 */
export function getSyntaxErrors(fileName: string, content: string): string[] {
  const backend = getTypescriptBackend();
  switch (backend.kind) {
    case 'classic': {
      const { diagnostics } = backend.ts.transpileModule(content, {
        fileName,
        reportDiagnostics: true,
        compilerOptions: { allowJs: true },
      });
      return (diagnostics ?? []).map((diagnostic) =>
        backend.ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')
      );
    }
    case 'api':
      return getApiSyntaxErrors(backend, fileName, content);
    default:
      return unhandledTypescriptBackend(backend);
  }
}

function getApiSyntaxErrors(
  backend: ApiTypescriptBackend,
  fileName: string,
  content: string
): string[] {
  const filePath = join(workspaceRoot, fileName);
  return withSingleFileProgram(backend, filePath, content, (program) =>
    program
      .getSyntacticDiagnostics(filePath)
      .map((diagnostic) => flattenApiDiagnosticMessage(diagnostic, ' '))
  );
}

/**
 * The message of a TypeScript 7.1 diagnostic with its chain, as TypeScript 6's
 * `flattenDiagnosticMessageText(messageText, newLine)` returns it.
 */
export function flattenApiDiagnosticMessage(
  diagnostic: ApiDiagnostic,
  newLine: string,
  indent = 0
): string {
  let result = indent ? newLine + '  '.repeat(indent) : '';
  result += diagnostic.text;
  for (const child of diagnostic.messageChain ?? []) {
    result += flattenApiDiagnosticMessage(child, newLine, indent + 1);
  }
  return result;
}
