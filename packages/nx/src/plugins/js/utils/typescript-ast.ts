import { join } from 'path';
import type * as ts from 'typescript';
import { workspaceRoot } from '../../../utils/workspace-root';
import {
  getTypescriptBackend,
  withTypescriptApi,
  type ApiTypescriptBackend,
  type ClassicTypescriptBackend,
  type TypescriptAstGuardsModule,
} from './typescript-backend';

type ApiDiagnostic = import('typescript/sync').Diagnostic;

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
  | 'createCallExpression'
  | 'createFalse'
  | 'createIdentifier'
  | 'createImportSpecifier'
  | 'createObjectLiteralExpression'
  | 'createPropertyAssignment'
  | 'createSpreadAssignment'
  | 'createStringLiteral'
  | 'createTrue'
  | 'createVariableDeclaration'
  | 'createVariableDeclarationList'
  | 'createVariableStatement'
> & {
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
  | 'getModifiers'
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
  NodeFlags: Pick<
    typeof ts.NodeFlags,
    'BlockScoped' | 'Const' | 'Let' | 'None'
  >;
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
    default: {
      const unhandled: never = backend;
      throw new Error(`Unhandled TypeScript backend: ${unhandled}`);
    }
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
    default: {
      const unhandled: never = backend;
      throw new Error(`Unhandled TypeScript backend: ${unhandled}`);
    }
  }
}

/**
 * Prints a node built with {@link TypescriptAst}'s `factory`. Throws for a
 * node that holds parsed code, which TypeScript 7.1 reprints without its
 * comments: insert the printed text into the source instead.
 */
export function printNode(node: ts.Node): string {
  const backend = getTypescriptBackend();
  switch (backend.kind) {
    case 'classic':
      assertBuiltNode(node, backend.ts.forEachChild);
      return backend.ts
        .createPrinter()
        .printNode(backend.ts.EmitHint.Unspecified, node, undefined);
    case 'api':
      assertBuiltNode(node, (parent, visit) => parent.forEachChild(visit));
      return withTypescriptApi(backend, (api) =>
        api.printer.printNode(node as never)
      );
    default: {
      const unhandled: never = backend;
      throw new Error(`Unhandled TypeScript backend: ${unhandled}`);
    }
  }
}

// Built nodes have no position in a source file.
function assertBuiltNode(
  node: ts.Node,
  forEachChild: (node: ts.Node, visit: (child: ts.Node) => void) => void
): void {
  if (node.pos >= 0) {
    throw new Error(
      'printNode only prints nodes built with the TypeScript factory, but the node holds code parsed from a file. Insert the printed nodes into the file text instead.'
    );
  }
  forEachChild(node, (child) => assertBuiltNode(child, forEachChild));
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
  return withTypescriptApi(backend, (api) => {
    const snapshot = api.createSnapshot({
      fileSystem: { kind: 'layer', files: { [fileName]: sourceFile.text } },
      createPrograms: [
        {
          rootFiles: [fileName],
          compilerOptions: { noLib: true, noResolve: true, types: [] },
        },
      ],
    });
    try {
      const [program] = snapshot.operation.createdPrograms;
      return program.getSyntacticDiagnostics(fileName).length > 0;
    } finally {
      snapshot.dispose();
    }
  });
}

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

const checkerCompilerOptions = {
  noLib: true,
  noResolve: true,
  allowJs: true,
  types: [],
};

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
    default: {
      const unhandled: never = backend;
      throw new Error(`Unhandled TypeScript backend: ${unhandled}`);
    }
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
  const program = ts.createProgram([fileName], checkerCompilerOptions, {
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
  return withTypescriptApi(backend, (api) => {
    const snapshot = api.createSnapshot({
      fileSystem: { kind: 'layer', files: { [filePath]: content } },
      createPrograms: [
        { rootFiles: [filePath], compilerOptions: checkerCompilerOptions },
      ],
    });
    try {
      const [program] = snapshot.operation.createdPrograms;
      const { checker } = snapshot.getProject(program.id);
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
    } finally {
      snapshot.dispose();
    }
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
  const factory = {
    createArrayLiteralExpression: (elements?: never[], multiLine?: boolean) =>
      f.createArrayLiteralExpression(elements ?? [], multiLine),
    createCallExpression: (
      expression: never,
      typeArguments: never[] | undefined,
      argumentsArray: never[] | undefined
    ) =>
      f.createCallExpression(
        expression,
        undefined,
        typeArguments,
        argumentsArray ?? [],
        NodeFlags.None
      ),
    createFalse: () => f.createKeywordExpression(SyntaxKind.FalseKeyword),
    createIdentifier: f.createIdentifier,
    createImportSpecifier: f.createImportSpecifier,
    createNumericLiteral: (value: string | number) =>
      f.createNumericLiteral(String(value), TokenFlags.None),
    createObjectLiteralExpression: (
      properties?: never[],
      multiLine?: boolean
    ) => f.createObjectLiteralExpression(properties ?? [], multiLine),
    createPropertyAssignment: (name: unknown, initializer: never) =>
      f.createPropertyAssignment(
        undefined,
        asIdentifier(name),
        undefined,
        undefined,
        initializer
      ),
    createSpreadAssignment: f.createSpreadAssignment,
    createStringLiteral: (text: string, isSingleQuote?: boolean) =>
      f.createStringLiteral(
        text,
        isSingleQuote ? TokenFlags.SingleQuote : TokenFlags.None
      ),
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
      f.createVariableDeclarationList(declarations, flags ?? NodeFlags.None),
    createVariableStatement: (
      modifiers: never[] | undefined,
      declarationList: never
    ) =>
      f.createVariableStatement(
        modifiers,
        Array.isArray(declarationList)
          ? f.createVariableDeclarationList(declarationList, NodeFlags.None)
          : declarationList
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
    default: {
      const unhandled: never = backend;
      throw new Error(`Unhandled TypeScript backend: ${unhandled}`);
    }
  }
}

function getApiSyntaxErrors(
  backend: ApiTypescriptBackend,
  fileName: string,
  content: string
): string[] {
  const filePath = join(workspaceRoot, fileName);
  return withTypescriptApi(backend, (api) => {
    const snapshot = api.createSnapshot({
      fileSystem: { kind: 'layer', files: { [filePath]: content } },
      createPrograms: [
        {
          rootFiles: [filePath],
          compilerOptions: {
            allowJs: true,
            noLib: true,
            noResolve: true,
            types: [],
          },
        },
      ],
    });
    try {
      const [program] = snapshot.operation.createdPrograms;
      return program
        .getSyntacticDiagnostics(filePath)
        .map((diagnostic) => flattenApiDiagnosticMessage(diagnostic, ' '));
    } finally {
      snapshot.dispose();
    }
  });
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
