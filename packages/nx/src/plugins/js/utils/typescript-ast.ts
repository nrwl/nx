import type * as ts from 'typescript';
import {
  getTypescriptBackend,
  withTypescriptApi,
  type ApiTypescriptBackend,
  type TypescriptAstGuardsModule,
} from './typescript-backend';

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
  | 'createSourceFile'
  | 'forEachChild'
  | 'ScriptKind'
  | 'ScriptTarget'
  | 'SyntaxKind'
  | RenamedNodeGuard
  | Exclude<
      Extract<keyof typeof ts & keyof TypescriptAstGuardsModule, `is${string}`>,
      (typeof divergentNodeGuards)[number]
    >
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
    createSourceFile,
    forEachChild: (
      node: { forEachChild: (...args: unknown[]) => unknown },
      cbNode: unknown,
      cbNodes?: unknown
    ) => node.forEachChild(cbNode, cbNodes),
    ScriptKind,
    ScriptTarget: ast.ScriptTarget,
    SyntaxKind,
  } as unknown as TypescriptAst;
}
