import { join } from 'path';
import type * as ts from 'typescript';
import { workspaceRoot } from '../../../utils/workspace-root';
import {
  getTypescriptBackend,
  withTypescriptApi,
  type ApiTypescriptBackend,
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
 */
export type TypescriptAst = Pick<
  typeof ts,
  | 'canHaveModifiers'
  | 'createSourceFile'
  | 'forEachChild'
  | 'getModifiers'
  | 'LanguageVariant'
  | 'ScriptKind'
  | 'ScriptTarget'
  | 'SyntaxKind'
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

const jsFilePattern = /\.[cm]?jsx?$/i;

function createApiAst(backend: ApiTypescriptBackend): TypescriptAst {
  const { ast, astGuards } = backend;
  const divergent = new Set<string>(divergentNodeGuards);
  const sharedGuards = Object.fromEntries(
    Object.entries(astGuards).filter(([name]) => !divergent.has(name))
  );
  const { ScriptKind, SyntaxKind } = ast;
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
    // TypeScript 7.1 drops a leading BOM from the text but still counts it in
    // positions.
    if (sourceText.charCodeAt(0) === 0xfeff) {
      Object.defineProperty(sourceFile, 'text', { value: sourceText });
    }
    return sourceFile;
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
    LanguageVariant: ast.LanguageVariant,
    ScriptKind,
    ScriptTarget: ast.ScriptTarget,
    SyntaxKind,
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
