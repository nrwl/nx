import { workspaceRoot } from './app-root';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import type * as ts from 'typescript';

const normalizedAppRoot = workspaceRoot.replace(/\\/g, '/');

let tsModule: typeof ts | undefined;

export function readTsConfig(tsConfigPath: string) {
  if (!tsModule) {
    tsModule = require('typescript');
  }
  const readResult = tsModule.readConfigFile(
    tsConfigPath,
    tsModule.sys.readFile
  );
  return tsModule.parseJsonConfigFileContent(
    readResult.config,
    tsModule.sys,
    dirname(tsConfigPath)
  );
}

function readTsConfigOptions(tsConfigPath: string) {
  if (!tsModule) {
    tsModule = require('typescript');
  }
  const readResult = tsModule.readConfigFile(
    tsConfigPath,
    tsModule.sys.readFile
  );
  // we don't need to scan the files, we only care about options
  const host = {
    readDirectory: () => [],
    fileExists: tsModule.sys.fileExists,
    readFile: tsModule.sys.readFile,
    useCaseSensitiveFileNames: tsModule.sys.useCaseSensitiveFileNames,
  };
  return tsModule.parseJsonConfigFileContent(
    readResult.config,
    host,
    dirname(tsConfigPath)
  ).options;
}

let compilerHost: {
  host: ts.CompilerHost;
  options: ts.CompilerOptions;
  moduleResolutionCache: ts.ModuleResolutionCache;
};

/**
 * Find a module based on it's import
 *
 * @param importExpr Import used to resolve to a module
 * @param filePath
 * @param tsConfigPath
 */
export function resolveModuleByImport(
  importExpr: string,
  filePath: string,
  tsConfigPath: string
) {
  if (!tsModule) {
    tsModule = require('typescript');
  }
  compilerHost = compilerHost || getCompilerHost(tsConfigPath);
  const { options, host, moduleResolutionCache } = compilerHost;

  const { resolvedModule } = tsModule.resolveModuleName(
    importExpr,
    filePath,
    options,
    host,
    moduleResolutionCache
  );

  if (!resolvedModule) {
    return;
  } else {
    return resolvedModule.resolvedFileName.replace(`${normalizedAppRoot}/`, '');
  }
}

function getCompilerHost(tsConfigPath: string) {
  if (!tsModule) {
    tsModule = require('typescript');
  }
  const options = readTsConfigOptions(tsConfigPath);
  const host = tsModule.createCompilerHost(options, true);
  const moduleResolutionCache = tsModule.createModuleResolutionCache(
    workspaceRoot,
    host.getCanonicalFileName
  );
  return { options, host, moduleResolutionCache };
}

export function getRootTsConfigFileName(): string | null {
  for (const tsConfigName of ['tsconfig.base.json', 'tsconfig.json']) {
    const tsConfigPath = join(workspaceRoot, tsConfigName);
    if (existsSync(tsConfigPath)) {
      return tsConfigName;
    }
  }

  return null;
}

export function getRootTsConfigPath(): string | null {
  const tsConfigFileName = getRootTsConfigFileName();

  return tsConfigFileName ? join(workspaceRoot, tsConfigFileName) : null;
}

export function getStringLiteralValue(node: ts.Node): string {
  return node.getText().slice(1, -1);
}

export function fileNameToScriptKind(fileName: string): ts.ScriptKind {
  if (!tsModule) {
    tsModule = require('typescript');
  }
  if (fileName.endsWith('.ts')) return tsModule.ScriptKind.TS;
  if (fileName.endsWith('.js')) return tsModule.ScriptKind.JS;
  if (fileName.endsWith('.tsx')) return tsModule.ScriptKind.TSX;
  if (fileName.endsWith('.jsx')) return tsModule.ScriptKind.JSX;
  return tsModule.ScriptKind.Unknown;
}

export function getSourceFile(fileName: string, contents: string) {
  if (!tsModule) {
    tsModule = require('typescript');
  }
  return tsModule.createSourceFile(
    fileName,
    contents,
    tsModule.ScriptTarget.ESNext,
    true,
    fileNameToScriptKind(fileName)
  );
}

export function getPropertyAssignmentName(
  propertyAssignment: ts.PropertyAssignment
) {
  if (!tsModule) {
    tsModule = require('typescript');
  }
  switch (true) {
    case tsModule.isIdentifier(propertyAssignment.name):
      return propertyAssignment.name.getText();
    case tsModule.isStringLiteral(propertyAssignment.name):
      return (propertyAssignment.name as ts.StringLiteral).text;
    default:
      return null;
  }
}

export function isKeyword(token: ts.SyntaxKind) {
  if (!tsModule) {
    tsModule = require('typescript');
  }
  return (
    tsModule.SyntaxKind.FirstKeyword <= token &&
    token <= tsModule.SyntaxKind.LastKeyword
  );
}

export function isJsxElementOrFragment(
  node: ts.Node
): node is ts.JsxElement | ts.JsxFragment {
  if (!tsModule) {
    tsModule = require('typescript');
  }
  return (
    node.kind === tsModule.SyntaxKind.JsxElement ||
    node.kind === tsModule.SyntaxKind.JsxFragment
  );
}

/**
 * The following utilities were extracted from:
 * https://github.com/microsoft/TypeScript/blob/ce85d647ef88183c019588bcf398320ce29b625a/src/compiler/core.ts
 */

type Comparer<T> = (a: T, b: T) => Comparison;

const enum Comparison {
  LessThan = -1,
  EqualTo = 0,
  GreaterThan = 1,
}

function isLineBreak(ch: number): boolean {
  if (!tsModule) {
    tsModule = require('typescript');
  }
  // The type side of the enum is not exported, but the value side is
  const CharacterCodes = (tsModule as any).CharacterCodes;

  // ES5 7.3:
  // The ECMAScript line terminator characters are listed in Table 3.
  //     Table 3: Line Terminator Characters
  //     Code Unit Value     Name                    Formal Name
  //     \u000A              Line Feed               <LF>
  //     \u000D              Carriage Return         <CR>
  //     \u2028              Line separator          <LS>
  //     \u2029              Paragraph separator     <PS>
  // Only the characters in Table 3 are treated as line terminators. Other new line or line
  // breaking characters are treated as white space but not as line terminators.

  return (
    ch === CharacterCodes.lineFeed ||
    ch === CharacterCodes.carriageReturn ||
    ch === CharacterCodes.lineSeparator ||
    ch === CharacterCodes.paragraphSeparator
  );
}

export function computeLineStarts(text: string): number[] {
  if (!tsModule) {
    tsModule = require('typescript');
  }
  // The type side of the enum is not exported, but the value side is
  const CharacterCodes = (tsModule as any).CharacterCodes;

  const result: number[] = new Array();
  let pos = 0;
  let lineStart = 0;
  while (pos < text.length) {
    const ch = text.charCodeAt(pos);
    pos++;
    switch (ch) {
      case CharacterCodes.carriageReturn:
        if (text.charCodeAt(pos) === CharacterCodes.lineFeed) {
          pos++;
        }
      // falls through
      case CharacterCodes.lineFeed:
        result.push(lineStart);
        lineStart = pos;
        break;
      default:
        if (ch > CharacterCodes.maxAsciiCharacter && isLineBreak(ch)) {
          result.push(lineStart);
          lineStart = pos;
        }
        break;
    }
  }
  result.push(lineStart);
  return result;
}

/**
 * We assume the first line starts at position 0 and 'position' is non-negative.
 */
export function computeLineOfPosition(
  lineStarts: readonly number[],
  position: number,
  lowerBound?: number
) {
  let lineNumber = binarySearch(
    lineStarts,
    position,
    identity,
    compareValues,
    lowerBound
  );
  if (lineNumber < 0) {
    // If the actual position was not found,
    // the binary search returns the 2's-complement of the next line start
    // e.g. if the line starts at [5, 10, 23, 80] and the position requested was 20
    // then the search will return -2.
    //
    // We want the index of the previous line start, so we subtract 1.
    // Review 2's-complement if this is confusing.
    lineNumber = ~lineNumber - 1;
    if (lineNumber === -1) {
      throw new Error('position cannot precede the beginning of the file');
    }
  }
  return lineNumber;
}

/**
 * Performs a binary search, finding the index at which `value` occurs in `array`.
 * If no such index is found, returns the 2's-complement of first index at which
 * `array[index]` exceeds `value`.
 * @param array A sorted array whose first element must be no larger than number
 * @param value The value to be searched for in the array.
 * @param keySelector A callback used to select the search key from `value` and each element of
 * `array`.
 * @param keyComparer A callback used to compare two keys in a sorted array.
 * @param offset An offset into `array` at which to start the search.
 */
function binarySearch<T, U>(
  array: readonly T[],
  value: T,
  keySelector: (v: T) => U,
  keyComparer: Comparer<U>,
  offset?: number
): number {
  return binarySearchKey(
    array,
    keySelector(value),
    keySelector,
    keyComparer,
    offset
  );
}

/**
 * Performs a binary search, finding the index at which an object with `key` occurs in `array`.
 * If no such index is found, returns the 2's-complement of first index at which
 * `array[index]` exceeds `key`.
 * @param array A sorted array whose first element must be no larger than number
 * @param key The key to be searched for in the array.
 * @param keySelector A callback used to select the search key from each element of `array`.
 * @param keyComparer A callback used to compare two keys in a sorted array.
 * @param offset An offset into `array` at which to start the search.
 */
function binarySearchKey<T, U>(
  array: readonly T[],
  key: U,
  keySelector: (v: T, i: number) => U,
  keyComparer: Comparer<U>,
  offset?: number
): number {
  if (!array || array.length <= 0) {
    return -1;
  }

  let low = offset || 0;
  let high = array.length - 1;
  while (low <= high) {
    const middle = low + ((high - low) >> 1);
    const midKey = keySelector(array[middle], middle);
    switch (keyComparer(midKey, key)) {
      case Comparison.LessThan:
        low = middle + 1;
        break;
      case Comparison.EqualTo:
        return middle;
      case Comparison.GreaterThan:
        high = middle - 1;
        break;
    }
  }

  return ~low;
}

function identity<T>(x: T) {
  return x;
}

function compareComparableValues(
  a: string | undefined,
  b: string | undefined
): Comparison;
function compareComparableValues(
  a: number | undefined,
  b: number | undefined
): Comparison;
function compareComparableValues(
  a: string | number | undefined,
  b: string | number | undefined
) {
  return a === b
    ? Comparison.EqualTo
    : a === undefined
    ? Comparison.LessThan
    : b === undefined
    ? Comparison.GreaterThan
    : a < b
    ? Comparison.LessThan
    : Comparison.GreaterThan;
}

/**
 * Compare two numeric values for their order relative to each other.
 */
function compareValues(
  a: number | undefined,
  b: number | undefined
): Comparison {
  return compareComparableValues(a, b);
}

export function lastOrUndefined<T>(array: readonly T[]): T | undefined {
  return array.length === 0 ? undefined : array[array.length - 1];
}

/**
 * The following comment traversal utilities were originally adapted from:
 * https://github.com/ajafff/tsutils
 */

/**
 * Iterate over all tokens of `node`
 *
 * @param node The node whose tokens should be visited
 * @param cb Is called for every token contained in `node`
 */
function forEachToken(
  node: ts.Node,
  cb: (node: ts.Node) => void,
  sourceFile: ts.SourceFile = node.getSourceFile()
) {
  if (!tsModule) {
    tsModule = require('typescript');
  }

  const queue = [];
  while (true) {
    if (tsModule.isTokenKind(node.kind)) {
      cb(node);
    } else if (node.kind !== tsModule.SyntaxKind.JSDocComment) {
      const children = node.getChildren(sourceFile);
      if (children.length === 1) {
        node = children[0];
        continue;
      }
      for (let i = children.length - 1; i >= 0; --i) queue.push(children[i]); // add children in reverse order, when we pop the next element from the queue, it's the first child
    }
    if (queue.length === 0) break;
    node = queue.pop()!;
  }
}

type ForEachCommentCallback = (
  fullText: string,
  comment: ts.CommentRange
) => void;

export function forEachComment(
  node: ts.Node,
  cb: ForEachCommentCallback,
  sourceFile: ts.SourceFile = node.getSourceFile()
) {
  if (!tsModule) {
    tsModule = require('typescript');
  }

  /**
   * Quoting from: https://github.com/ajafff/tsutils
   *
   * "Visit all tokens and skip trivia.
   * Comment ranges between tokens are parsed without the need of a scanner.
   * forEachTokenWithWhitespace does intentionally not pay attention to the correct comment ownership of nodes as it always
   * scans all trivia before each token, which could include trailing comments of the previous token.
   * Comment onwership is done right in this function"
   */
  const fullText = sourceFile.text;
  const notJsx = sourceFile.languageVariant !== tsModule.LanguageVariant.JSX;

  function commentCallback(pos: number, end: number, kind: ts.CommentKind) {
    cb(fullText, { pos, end, kind });
  }

  return forEachToken(
    node,
    (token) => {
      if (token.pos === token.end) return;
      if (token.kind !== tsModule.SyntaxKind.JsxText)
        tsModule.forEachLeadingCommentRange(
          fullText,
          // skip shebang at position 0
          token.pos === 0
            ? (tsModule.getShebang(fullText) || '').length
            : token.pos,
          commentCallback
        );
      if (notJsx || canHaveTrailingTrivia(token))
        return tsModule.forEachTrailingCommentRange(
          fullText,
          token.end,
          commentCallback
        );
    },
    sourceFile
  );
}

/**
 * Exclude trailing positions that would lead to scanning for trivia inside JsxText
 */
function canHaveTrailingTrivia(token: ts.Node): boolean {
  if (!tsModule) {
    tsModule = require('typescript');
  }
  const SyntaxKind = tsModule.SyntaxKind;

  switch (token.kind) {
    case SyntaxKind.CloseBraceToken:
      // after a JsxExpression inside a JsxElement's body can only be other JsxChild, but no trivia
      return (
        token.parent!.kind !== SyntaxKind.JsxExpression ||
        !isJsxElementOrFragment(token.parent!.parent!)
      );
    case SyntaxKind.GreaterThanToken:
      switch (token.parent!.kind) {
        case SyntaxKind.JsxOpeningElement:
          // if end is not equal, this is part of the type arguments list. in all other cases it would be inside the element body
          return token.end !== token.parent!.end;
        case SyntaxKind.JsxOpeningFragment:
          return false; // would be inside the fragment
        case SyntaxKind.JsxSelfClosingElement:
          return (
            token.end !== token.parent!.end || // if end is not equal, this is part of the type arguments list
            !isJsxElementOrFragment(token.parent!.parent!)
          ); // there's only trailing trivia if it's the end of the top element
        case SyntaxKind.JsxClosingElement:
        case SyntaxKind.JsxClosingFragment:
          // there's only trailing trivia if it's the end of the top element
          return !isJsxElementOrFragment(token.parent!.parent!.parent!);
      }
  }
  return true;
}
