import type * as ts from 'typescript';
import {
  getNxRequirePaths,
  resolveInstalledPackage,
} from '../../../utils/installation-directory';
import {
  unhandledTypescriptBackend,
  withTypescriptApi,
  type ApiTypescriptBackend,
  type TypescriptBackend,
} from './typescript-backend';

/** @ts-ignore resolves only when `typescript` is >= 7.1 */
type TypescriptAstVisitorModule = typeof import('typescript/ast/visitor');

/** What the printer needs from the adapter in `typescript-ast.ts`. */
export interface TypescriptPrinterHost {
  ast: Pick<typeof ts, 'createSourceFile' | 'forEachChild' | 'ScriptTarget'> & {
    SyntaxKind: Record<string, number | string>;
  };
  hasParseErrors(sourceFile: ts.SourceFile): boolean;
}

export interface TypescriptPrinter {
  /**
   * The text for `[original.getStart(), original.end)` after the edit that
   * turned `original` into `updated`. Text of parsed nodes is copied from the
   * file, never reprinted. Throws for an edit it does not support, and when
   * the file with the result spliced in no longer parses.
   */
  printNodeUpdate(original: ts.Node, updated: ts.Node): string;
  /** Prints a node that holds no parsed code, with its leading comments. */
  printBuiltNode(node: ts.Node): string;
  /**
   * Stands in for `ts.addSyntheticLeadingComment`, which TypeScript 7.1 lacks.
   * Only a `//` comment on an element of a built multi-line object or array
   * literal can be printed.
   */
  addSyntheticLeadingComment<T extends ts.Node>(
    node: T,
    kind: ts.SyntaxKind,
    text: string,
    hasTrailingNewLine?: boolean
  ): T;
}

type ListClassName = 'expr' | 'objectMember' | 'importSpecifier';
type ListClass = {
  separator: string;
  padding: string;
  placeholder: (name: string) => ts.Node;
};
type ListSlot = {
  kind: 'list';
  name: string;
  listClass?: ListClassName;
  addable?: boolean;
  removable?: boolean;
};
// fixed: the same node on both sides. token: the same token kind.
// string: a parsed string literal may become a built one.
type ChildSlot = {
  kind: 'child';
  name: string;
  rule: 'fixed' | 'token' | 'string';
};
type Slot = ListSlot | ChildSlot;
// chainState: the optional chain flag is syntax that no child slot carries.
type Row = { slots: Slot[]; chainState?: boolean };

type TriviaToken = {
  kind: 'ws' | 'nl' | 'line' | 'block' | 'sep';
  start: number;
  end: number;
};
type Lead = { cut: number; ws: string; head: string };
type Trail = {
  raw: string;
  pre: string;
  post: string;
  preBlock: string;
  preLine: string;
  hasSeparator: boolean;
  cut: number;
  stop: number;
};
type Item = {
  kind: ts.SyntaxKind;
  body: string;
  head?: string;
  ws?: string;
  index?: number;
  trail?: Trail;
};
type Lazy<T> = () => T;
type WriteOptions = {
  firstWs: string;
  junction: (item: Item) => string;
  trailingSeparator: boolean;
  newLine: string;
  indent: Lazy<string>;
  closing: string;
  closingIndent: Lazy<string>;
  afterBreak?: boolean;
};
type TextEdit = { start: number; end: number; text: string };
type Placement = {
  list: ts.NodeArray<ts.Node> | undefined;
  slot: Slot;
  parent: ts.Node;
};
// A stretch of printed text to fill in: comment lines, a list that holds
// parsed elements, or an update of a parsed node.
type Unit = {
  names: string[];
  start?: number;
  end?: number;
  comment?: string[];
  update?: { source: ts.Node; updated: ts.Node };
  list?: {
    listClass: ListClass;
    className: ListClassName;
    where: string;
    elements: ts.Node[];
  };
};
type NodeList = ts.NodeArray<ts.Node>;
// What differs between the TypeScript 6 module and the TypeScript 7.1 API.
type BackendOps = {
  optionalChain: number;
  print(node: ts.Node): string;
  visitEachChild(node: ts.Node, visit: (child: ts.Node) => ts.Node): ts.Node;
  identifier(name: string): ts.Node;
  shorthandProperty(name: string): ts.Node;
  importSpecifier(name: string): ts.Node;
  parenthesized(expression: ts.Node): ts.Node;
  newExpression(
    expression: ts.Node,
    typeArguments: NodeList | undefined,
    args: NodeList | undefined
  ): ts.Node;
  objectLiteral(properties: ts.Node[]): ts.Node;
  arrayLiteral(elements: ts.Node[]): ts.Node;
};

const BREAK = /[\r\n\u2028\u2029]/;
const COMMENT_PLACE =
  'a leading comment on a built node that is not an element of a built object or array literal printed one element per line';
const IDENTIFIER =
  '(?:[\\p{ID_Start}$_]|\\\\u[0-9a-fA-F]{4}|\\\\u\\{[0-9a-fA-F]+\\})(?:[\\p{ID_Continue}$\\u200c\\u200d]|\\\\u[0-9a-fA-F]{4}|\\\\u\\{[0-9a-fA-F]+\\})*';
const PLAIN_IDENTIFIER = new RegExp(`^${IDENTIFIER}$`, 'u');
const DOTTED_IDENTIFIER = new RegExp(`^${IDENTIFIER}(\\.${IDENTIFIER})*$`, 'u');

// One table for both backends, so both write the same comment bytes.
const leadingComments = new WeakMap<ts.Node, string[]>();

const updateOrigins = new WeakMap<ts.Node, ts.Node>();

/**
 * Records that `updated` came from a `factory.update*` call on `original`.
 * TypeScript 6 keeps that link on the node. TypeScript 7.1 keeps none, so its
 * factory adapter has to call this.
 */
export function recordUpdateOrigin(updated: ts.Node, original: ts.Node): void {
  if (updated !== original) updateOrigins.set(updated, original);
}

function fail(message: string): never {
  throw new Error(`Unsupported node update: ${message}`);
}

function unhandled(value: never): never {
  throw new Error(`Unhandled value: ${String(value)}`);
}

function lazy<T>(compute: () => T): Lazy<T> {
  let done = false;
  let value: T;
  return () => {
    if (!done) {
      value = compute();
      done = true;
    }
    return value;
  };
}

const isBreak = (c: number) =>
  c === 10 || c === 13 || c === 0x2028 || c === 0x2029;

// TypeScript's single-line whitespace set.
const isSpace = (c: number) =>
  c === 32 ||
  c === 9 ||
  c === 11 ||
  c === 12 ||
  c === 0xa0 ||
  c === 0x85 ||
  c === 0x1680 ||
  (c >= 0x2000 && c <= 0x200b) ||
  c === 0x202f ||
  c === 0x205f ||
  c === 0x3000 ||
  c === 0xfeff;

// Stops at the first character that is not trivia or the one separator.
function scanTrivia(
  text: string,
  pos: number,
  end: number,
  separator: string | undefined
): { tokens: TriviaToken[]; stop: number } {
  const tokens: TriviaToken[] = [];
  let separatorSeen = false;
  while (pos < end) {
    const c = text.charCodeAt(pos);
    let tokenEnd = pos;
    let kind: TriviaToken['kind'];
    if (isBreak(c)) {
      tokenEnd =
        c === 13 && text.charCodeAt(pos + 1) === 10 ? pos + 2 : pos + 1;
      kind = 'nl';
    } else if (isSpace(c)) {
      while (tokenEnd < end && isSpace(text.charCodeAt(tokenEnd))) tokenEnd++;
      kind = 'ws';
    } else if (c === 47 && text.charCodeAt(pos + 1) === 47) {
      while (tokenEnd < end && !isBreak(text.charCodeAt(tokenEnd))) tokenEnd++;
      kind = 'line';
    } else if (c === 47 && text.charCodeAt(pos + 1) === 42) {
      const close = text.indexOf('*/', pos + 2);
      tokenEnd = close < 0 ? end : close + 2;
      kind = 'block';
    } else if (separator && !separatorSeen && text[pos] === separator) {
      tokenEnd = pos + 1;
      kind = 'sep';
      separatorSeen = true;
    } else {
      break;
    }
    tokens.push({ kind, start: pos, end: tokenEnd });
    pos = tokenEnd;
  }
  return { tokens, stop: pos };
}

const isComment = (token: TriviaToken) =>
  token.kind === 'line' || token.kind === 'block';

function endsWithLineComment(
  text: string,
  separator: string | undefined
): boolean {
  const { tokens } = scanTrivia(text, 0, text.length, separator);
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (tokens[i].kind !== 'ws') return tokens[i].kind === 'line';
  }
  return false;
}

const startsWithBreak = (text: string) =>
  /^[ \t]*[\r\n\u2028\u2029]/.test(text);

/**
 * Creates the printer for one TypeScript package. `printNodeUpdate` supports
 * the edits Nx's generators and migrations make and throws for every other.
 */
export function createTypescriptPrinter(
  backend: TypescriptBackend,
  host: TypescriptPrinterHost
): TypescriptPrinter {
  const { ast } = host;
  const K = ast.SyntaxKind as Record<string, number>;
  const kindName = (kind: number) =>
    (ast.SyntaxKind as Record<number, string>)[kind] ?? String(kind);
  const ops = createBackendOps(backend);
  const slotValue = (node: ts.Node, name: string) =>
    (node as unknown as Record<string, ts.Node | NodeList | undefined>)[name];
  const childOf = (node: ts.Node, name: string) =>
    slotValue(node, name) as ts.Node | undefined;
  const listOf = (node: ts.Node, name: string) =>
    slotValue(node, name) as NodeList | undefined;
  const textOfNode = (node: ts.Node) => (node as ts.Identifier).text;

  const listClasses: Record<ListClassName, ListClass> = {
    expr: { separator: ',', padding: '', placeholder: ops.identifier },
    objectMember: {
      separator: ',',
      padding: ' ',
      placeholder: ops.shorthandProperty,
    },
    importSpecifier: {
      separator: ',',
      padding: ' ',
      placeholder: ops.importSpecifier,
    },
  };
  const list = (
    name: string,
    listClass?: ListClassName,
    options?: { addable?: boolean; removable?: boolean }
  ): ListSlot => ({ kind: 'list', name, listClass, ...options });
  const child = (name: string, rule: ChildSlot['rule']): ChildSlot => ({
    kind: 'child',
    name,
    rule,
  });
  // Every child slot of each kind, in source order. A slot missing here would
  // let a change to it print as if nothing changed.
  const rows: Record<string, Row> = {
    CallExpression: {
      chainState: true,
      slots: [
        child('expression', 'fixed'),
        child('questionDotToken', 'token'),
        list('typeArguments'),
        list('arguments', 'expr'),
      ],
    },
    NewExpression: {
      slots: [
        child('expression', 'fixed'),
        list('typeArguments', undefined, { removable: true }),
        list('arguments', 'expr', { addable: true }),
      ],
    },
    ArrayLiteralExpression: { slots: [list('elements', 'expr')] },
    ObjectLiteralExpression: { slots: [list('properties', 'objectMember')] },
    NamedImports: { slots: [list('elements', 'importSpecifier')] },
    ImportDeclaration: {
      slots: [
        list('modifiers'),
        child('importClause', 'fixed'),
        child('moduleSpecifier', 'string'),
        child('attributes', 'fixed'),
        child('assertClause', 'fixed'),
      ],
    },
  };
  const rowByKind = new Map<number, Row>(
    Object.entries(rows).map(([name, row]) => [K[name], row])
  );
  const kinds = (names: string[]) => new Set(names.map((name) => K[name]));
  // The kinds Nx's generators build. Both native printers print them alike.
  const builtKinds = kinds([
    'Identifier',
    'StringLiteral',
    'NumericLiteral',
    'TrueKeyword',
    'FalseKeyword',
    'NullKeyword',
    'ObjectLiteralExpression',
    'ArrayLiteralExpression',
    'PropertyAssignment',
    'ShorthandPropertyAssignment',
    'SpreadAssignment',
    'SpreadElement',
    'CallExpression',
    'PropertyAccessExpression',
    'ElementAccessExpression',
    'ImportSpecifier',
    'MetaProperty',
    'VariableStatement',
    'VariableDeclarationList',
    'VariableDeclaration',
    'PrefixUnaryExpression',
    'AwaitExpression',
    'ArrowFunction',
    'Parameter',
    'EqualsGreaterThanToken',
    'ParenthesizedExpression',
  ]);
  const calleeKinds = kinds([
    'Identifier',
    'PropertyAccessExpression',
    'ElementAccessExpression',
    'CallExpression',
    'MetaProperty',
  ]);
  const nameParentKinds = kinds([
    'PropertyAssignment',
    'ShorthandPropertyAssignment',
    'PropertyAccessExpression',
    'MetaProperty',
    'Parameter',
    'VariableDeclaration',
  ]);
  const statementParentKinds = kinds([
    'SourceFile',
    'Block',
    'CaseClause',
    'DefaultClause',
  ]);
  const chainLinkKinds = kinds([
    'PropertyAccessExpression',
    'ElementAccessExpression',
    'NonNullExpression',
  ]);

  const isParsed = (node: ts.Node) =>
    node.parent !== undefined && node.pos >= 0;
  const fileByNode = new WeakMap<ts.Node, ts.SourceFile>();
  const fileOf = (node: ts.Node) => {
    let file = fileByNode.get(node);
    if (file === undefined) {
      file = node.getSourceFile();
      fileByNode.set(node, file);
    }
    return file;
  };
  const textOf = (node: ts.Node) => fileOf(node).text;
  // An array hole has no token, so `getStart` would run into what follows it.
  const startOf = (node: ts.Node) =>
    node.kind === K.OmittedExpression ? node.end : node.getStart(fileOf(node));
  const ownText = (node: ts.Node) =>
    textOf(node).slice(startOf(node), node.end);

  const holdsParsed = (node: ts.Node): boolean => {
    if (isParsed(node)) return true;
    let found = false;
    ast.forEachChild(
      node,
      (c) => {
        found = found || holdsParsed(c);
      },
      (cs) => {
        for (const c of cs) found = found || holdsParsed(c);
      }
    );
    return found;
  };

  let root: ts.Node;
  let tagCount = 0;

  let newLineText: string | undefined;
  let newLineValue = '\n';
  const newLineOf = (text: string) => {
    if (text !== newLineText) {
      const first = /\r\n|\n|\r/.exec(text);
      newLineText = text;
      newLineValue = first && first[0] === '\r\n' ? '\r\n' : '\n';
    }
    return newLineValue;
  };
  // Remembers the last line start: a list on one long line asks for the same
  // line once per element.
  let indentText: string | undefined;
  let indentPos = -1;
  let indentLineStart = 0;
  function lineIndentAt(text: string, pos: number): string {
    let start = pos;
    while (start > 0 && !isBreak(text.charCodeAt(start - 1))) {
      if (text === indentText && start === indentPos) {
        start = indentLineStart;
        break;
      }
      start--;
    }
    indentText = text;
    indentPos = pos;
    indentLineStart = start;
    let end = start;
    while (end < pos && (text[end] === ' ' || text[end] === '\t')) end++;
    return text.slice(start, end);
  }

  function placementOf(node: ts.Node): Placement | undefined {
    const parent = node.parent;
    const row = parent && rowByKind.get(parent.kind);
    if (!row) return undefined;
    for (const slot of row.slots) {
      const value = slotValue(parent, slot.name);
      if (!value) continue;
      if (slot.kind === 'list') {
        const nodes = value as NodeList;
        if (
          nodes.length > 0 &&
          nodes.pos <= node.pos &&
          node.end <= nodes.end
        ) {
          return { list: nodes, slot, parent };
        }
      } else if (value === node) {
        return { list: undefined, slot, parent };
      }
    }
    return undefined;
  }

  // Comments before the first line break belong to the previous element, or to
  // the list when the element is first.
  function leadOf(node: ts.Node, text: string, isFirst: boolean): Lead {
    const start = startOf(node);
    const { tokens } = scanTrivia(text, node.pos, start, undefined);
    let cut = node.pos;
    const lineBreak = tokens.findIndex((t) => t.kind === 'nl');
    if (lineBreak >= 0) {
      for (let i = 0; i < lineBreak; i++) {
        if (isComment(tokens[i])) cut = tokens[i].end;
      }
    }
    if (isFirst) {
      // A comment followed by a blank line belongs to the list.
      for (let i = 0; i < tokens.length; i++) {
        if (!isComment(tokens[i]) || tokens[i].end <= cut) continue;
        let lineBreaks = 0;
        for (let j = i + 1; j < tokens.length && !isComment(tokens[j]); j++) {
          if (tokens[j].kind === 'nl') lineBreaks++;
        }
        if (lineBreaks >= 2) cut = tokens[i].end;
      }
    }
    const firstComment = tokens.find((t) => isComment(t) && t.start >= cut);
    const headStart = firstComment ? firstComment.start : start;
    return {
      cut,
      ws: text.slice(cut, headStart),
      head: text.slice(headStart, start),
    };
  }

  // Runs through the separator wherever it sits, so a trail and the next lead
  // are the whole gap between two elements.
  function trailOf(
    node: ts.Node,
    text: string,
    separator: string,
    isLast: boolean,
    limit: number,
    toCloser?: boolean
  ): Trail {
    const { tokens, stop } = scanTrivia(text, node.end, limit, separator);
    const separatorIndex = tokens.findIndex((t) => t.kind === 'sep');
    const from = separatorIndex + 1;
    let lineBreak = -1;
    for (let i = from; i < tokens.length; i++) {
      if (tokens[i].kind === 'nl') {
        lineBreak = i;
        break;
      }
    }
    let last = separatorIndex;
    if (lineBreak >= 0 || isLast) {
      const until = lineBreak >= 0 && !toCloser ? lineBreak : tokens.length;
      for (let i = from; i < until; i++) {
        if (isComment(tokens[i])) last = i;
      }
    }
    const cut = last >= 0 ? tokens[last].end : node.end;
    const hasSeparator = separatorIndex >= 0;
    const raw = text.slice(node.end, cut);
    const firstLine = hasSeparator
      ? undefined
      : tokens.slice(0, last + 1).find((t) => t.kind === 'line');
    const splitAt = firstLine ? firstLine.start : cut;
    return {
      raw,
      pre: hasSeparator
        ? text.slice(node.end, tokens[separatorIndex].start)
        : raw,
      post: hasSeparator ? text.slice(tokens[separatorIndex].end, cut) : '',
      preBlock: hasSeparator ? '' : text.slice(node.end, splitAt).trimEnd(),
      preLine: firstLine ? ' ' + text.slice(firstLine.start, cut) : '',
      hasSeparator,
      cut,
      stop,
    };
  }

  const isListOnly = (kind: number) => {
    const row = rowByKind.get(kind);
    return !!row && row.slots.every((slot) => slot.kind === 'list');
  };

  // The parsed node a built list element is an update of: the one its first
  // parsed direct child still sits under. A kind with single-child slots is
  // identified by those, so a new call around an old argument is not one.
  function anchorOf(updated: ts.Node): ts.Node | undefined {
    const row = rowByKind.get(updated.kind);
    if (!row) return undefined;
    const listOnly = isListOnly(updated.kind);
    for (const slot of row.slots) {
      const value = slotValue(updated, slot.name);
      if (!value) continue;
      if (slot.kind === 'list') {
        if (!listOnly) continue;
        for (const element of value as NodeList) {
          if (!isParsed(element)) continue;
          const parent = element.parent;
          if (parent.kind !== updated.kind) return undefined;
          const nodes = listOf(parent, slot.name);
          return nodes && nodes.pos <= element.pos && element.end <= nodes.end
            ? parent
            : undefined;
        }
      } else {
        if (slot.rule === 'token') continue;
        const node = value as ts.Node;
        if (!isParsed(node)) continue;
        const parent = node.parent;
        if (parent.kind !== updated.kind) return undefined;
        return childOf(parent, slot.name) === node ? parent : undefined;
      }
    }
    return undefined;
  }

  // The parsed node a built node inside a built tree is an update of. Its
  // text is copied and edited, never reprinted, so its comments and layout
  // stay.
  function updateSourceOf(node: ts.Node): ts.Node | undefined {
    if (!rowByKind.has(node.kind)) return undefined;
    let origin =
      updateOrigins.get(node) ??
      (node as ts.Node & { original?: ts.Node }).original;
    while (origin && !isParsed(origin)) {
      origin =
        updateOrigins.get(origin) ??
        (origin as ts.Node & { original?: ts.Node }).original;
    }
    return origin && origin.kind === node.kind ? origin : anchorOf(node);
  }

  function assertUpdateSourceInReach(source: ts.Node, where: string): void {
    if (fileOf(source) !== fileOf(root)) {
      fail(
        `update of a ${kindName(source.kind)} from another file in ${where}`
      );
    }
  }

  function editText(original: ts.Node, updated: ts.Node): string {
    const row = rowByKind.get(original.kind);
    const optionalChain = ops.optionalChain;
    if (
      row.chainState &&
      ((original.flags ?? 0) & optionalChain) !==
        ((updated.flags ?? 0) & optionalChain)
    ) {
      fail(
        `change of the optional chain state of a ${kindName(original.kind)}`
      );
    }
    const text = textOf(original);
    const from = startOf(original);
    const to = original.end;
    const newLine = newLineOf(text);
    const edits: TextEdit[] = [];
    for (const slot of row.slots) {
      const a = slotValue(original, slot.name);
      const b = slotValue(updated, slot.name);
      const where = `${kindName(original.kind)}.${slot.name}`;
      if (a === b || (a == null && b == null)) continue;
      if (slot.kind === 'list') {
        const before = a as NodeList | undefined;
        const after = b as NodeList | undefined;
        if (slot.removable && before && !after) {
          // Only `<` through `>` goes: trivia before `<` may hold a comment.
          const { stop } = scanTrivia(text, before.end, to, ',');
          if (text[stop] !== '>') fail(`${where} removed`);
          if (text[before.pos - 1] !== '<') fail(`${where} removed`);
          edits.push({ start: before.pos - 1, end: stop + 1, text: '' });
          continue;
        }
        if (
          before &&
          after &&
          before.length === after.length &&
          before.every((node, i) => node === after[i])
        ) {
          continue;
        }
        if (!before && slot.addable) {
          const callee = childOf(original, 'expression');
          // In `new new A` the added arguments would bind to the inner `new`.
          if (callee.kind === K.NewExpression && !listOf(callee, 'arguments')) {
            fail(
              `${where} added to a NewExpression whose callee is a NewExpression without arguments`
            );
          }
          const listClass = listClasses[slot.listClass];
          const indent = lazy(() => lineIndentAt(text, from));
          const items = [...(after ?? [])].map((node) =>
            newItem(node, listClass, slot.listClass, where, indent, newLine)
          );
          edits.push({
            start: to,
            end: to,
            text:
              '(' +
              writeItems(items, listClass, {
                firstWs: '',
                junction: () => ' ',
                trailingSeparator: false,
                newLine,
                indent,
                closing: ')',
                closingIndent: indent,
              }),
          });
          continue;
        }
        if (!before) fail(`${where} added`);
        if (!after) fail(`${where} removed`);
        if (!slot.listClass) fail(`edit of the list ${where}`);
        edits.push(
          listEdit(original, updated, before, [...after], slot, text, to)
        );
      } else {
        const before = a as ts.Node | undefined;
        const after = b as ts.Node | undefined;
        if (before == null || after == null) {
          fail(`${where} ${before == null ? 'added' : 'removed'}`);
        }
        switch (slot.rule) {
          case 'token':
            if (before.kind !== after.kind) {
              fail(`change of the token ${where}`);
            }
            break;
          case 'fixed':
            fail(`change of ${where}`);
            break;
          case 'string':
            if (
              isParsed(after) ||
              after.kind !== K.StringLiteral ||
              before.kind !== K.StringLiteral
            ) {
              fail(`change of ${where}`);
            }
            edits.push({
              start: startOf(before),
              end: before.end,
              text: ops.print(after),
            });
            break;
          default:
            unhandled(slot.rule);
        }
      }
    }
    edits.sort((x, y) => x.start - y.start);
    const parts: string[] = [];
    let pos = from;
    for (const edit of edits) {
      parts.push(text.slice(pos, edit.start), edit.text);
      pos = edit.end;
    }
    parts.push(text.slice(pos, to));
    return parts.join('');
  }

  // A parsed element taken from another list.
  function movedItem(
    source: ts.Node,
    listClass: ListClass,
    className: ListClassName,
    where: string
  ): Item {
    if (source.kind === K.OmittedExpression) {
      fail(`array hole moved into ${where}`);
    }
    if (fileOf(source) !== fileOf(root)) {
      fail(`${kindName(source.kind)} moved into ${where} from another file`);
    }
    if (!rowByKind.has(source.parent.kind)) {
      fail(
        `element reused from a ${kindName(source.parent.kind)}, which has no slot table entry`
      );
    }
    const at = placementOf(source);
    if (
      !at ||
      !at.list ||
      at.slot.kind !== 'list' ||
      at.slot.listClass !== className
    ) {
      fail(
        `${kindName(source.kind)} moved into ${where} from ${
          at && at.list
            ? `${kindName(source.parent.kind)}.${at.slot.name}`
            : `a ${kindName(source.parent.kind)} slot that is not a list`
        }`
      );
    }
    const text = textOf(source);
    const isFirst = at.list.pos === source.pos;
    const isLast = at.list[at.list.length - 1] === source;
    let head = leadOf(source, text, isFirst).head;
    // TypeScript 6 prints the comments on the old list's opener line, and
    // those before its closer, with the first and last element.
    if (isFirst) {
      const start = startOf(source);
      const comment = scanTrivia(
        text,
        source.pos,
        start,
        undefined
      ).tokens.find(isComment);
      if (comment) head = text.slice(comment.start, start);
    }
    return {
      kind: source.kind,
      head,
      trail: trailOf(
        source,
        text,
        listClass.separator,
        isLast,
        at.parent.end,
        isLast
      ),
      body: ownText(source),
    };
  }

  function newItem(
    node: ts.Node,
    listClass: ListClass,
    className: ListClassName,
    where: string,
    indent: Lazy<string>,
    newLine: string
  ): Item {
    if (isParsed(node)) return movedItem(node, listClass, className, where);
    return {
      kind: node.kind,
      body: printWithParsedElements(node, where, indent, newLine),
    };
  }

  function writeItems(
    items: Item[],
    listClass: ListClass,
    options: WriteOptions
  ): string {
    const parts: string[] = [];
    // After a `//` comment the next piece has to start on a new line.
    let afterLineComment = false;
    items.forEach((item, i) => {
      const lead =
        (i === 0 ? options.firstWs : options.junction(item)) +
        (item.head ?? '');
      if (afterLineComment && !startsWithBreak(lead)) {
        parts.push(options.newLine + options.indent());
      }
      parts.push(lead, item.body);
      afterLineComment = false;
      // A hole exists only through the separator after it.
      const needsSeparator =
        i < items.length - 1 ||
        options.trailingSeparator ||
        item.kind === K.OmittedExpression;
      if (item.trail) {
        const trail = item.trail;
        let text: string;
        if (needsSeparator) {
          text = trail.hasSeparator
            ? trail.raw
            : trail.preBlock + listClass.separator + trail.preLine;
        } else if (trail.hasSeparator) {
          text = trail.post ? trail.pre + trail.post : trail.pre.trimEnd();
        } else {
          text = trail.raw;
        }
        parts.push(text);
        afterLineComment =
          text !== '' &&
          text !== listClass.separator &&
          endsWithLineComment(text, listClass.separator);
      } else if (needsSeparator) {
        parts.push(listClass.separator);
      }
    });
    const closingOnNewLine = options.closing
      ? startsWithBreak(options.closing)
      : options.afterBreak;
    if (afterLineComment && !closingOnNewLine) {
      parts.push(options.newLine + options.closingIndent());
    }
    parts.push(options.closing);
    return parts.join('');
  }

  // Replaces the inside of a parsed list, from after the opener to before the
  // closer.
  function listEdit(
    original: ts.Node,
    updated: ts.Node,
    before: NodeList,
    after: ts.Node[],
    slot: ListSlot,
    text: string,
    parentEnd: number
  ): TextEdit {
    const listClass = listClasses[slot.listClass];
    const newLine = newLineOf(text);
    const where = `${kindName(original.kind)}.${slot.name}`;
    const count = before.length;
    const ownerIndent = lazy(() => lineIndentAt(text, startOf(original)));
    if (count === 0) {
      const { tokens, stop } = scanTrivia(
        text,
        before.pos,
        parentEnd,
        undefined
      );
      const comments = tokens.filter(isComment);
      const kept = comments.length
        ? text.slice(before.pos, comments[comments.length - 1].end)
        : '';
      // An empty literal has no layout to follow, so the updated node's
      // `multiLine` decides, as it does for TypeScript's printer. A `//`
      // comment inside the brackets needs the line breaks either way.
      const multiLine = isLiteral(original)
        ? !!(updated as ts.ObjectLiteralExpression & { multiLine?: boolean })
            .multiLine || endsWithLineComment(kept, undefined)
        : tokens.some((t) => t.kind === 'nl');
      const closeIndent = lazy(() => lineIndentAt(text, stop));
      const indent = multiLine
        ? lazy(
            () => ownerIndent() + (closeIndent().includes('\t') ? '\t' : '    ')
          )
        : ownerIndent;
      const items = after.map((node) =>
        newItem(node, listClass, slot.listClass, where, indent, newLine)
      );
      return {
        start: before.pos,
        end: stop,
        text: writeItems(items, listClass, {
          firstWs:
            kept +
            (multiLine ? newLine + indent() : kept ? ' ' : listClass.padding),
          junction: () => (multiLine ? newLine + indent() : ' '),
          trailingSeparator: false,
          newLine,
          indent,
          closing: multiLine ? newLine + closeIndent() : listClass.padding,
          closingIndent: closeIndent,
        }),
      };
    }
    const first = before[0];
    const last = before[count - 1];
    const leadFirst = leadOf(first, text, true);
    const trailLast = trailOf(last, text, listClass.separator, true, parentEnd);
    const stop = trailLast.stop;
    const closing = text.slice(trailLast.cut, stop);
    const closeIndent = lazy(() => lineIndentAt(text, stop));
    const listOwned = text.slice(before.pos, leadFirst.cut);
    if (after.length === 0) {
      if (!/\/[/*]/.test(listOwned + closing)) {
        return { start: before.pos, end: stop, text: '' };
      }
      // A `//` comment on the opener line would swallow the closer.
      const guard =
        endsWithLineComment(listOwned, undefined) && !startsWithBreak(closing)
          ? newLine + closeIndent()
          : '';
      return {
        start: before.pos,
        end: stop,
        text: listOwned + guard + closing,
      };
    }
    const indexByNode = new Map<ts.Node, number>();
    for (let i = 0; i < count; i++) indexByNode.set(before[i], i);
    const own = after.map((node) =>
      indexByNode.get(isParsed(node) ? node : anchorOf(node))
    );
    const taken = new Set(own.filter((index) => index !== undefined));
    after.forEach((node, i) => {
      // An object or array that kept no parsed code replaces the removed
      // element of its kind at its position, and so keeps its comments.
      if (
        own[i] === undefined &&
        !isParsed(node) &&
        i < count &&
        !taken.has(i) &&
        before[i].kind === node.kind &&
        isListOnly(node.kind) &&
        !holdsParsed(node)
      ) {
        own[i] = i;
        taken.add(i);
      }
    });
    let previousIndex = -1;
    for (const index of own) {
      if (index === undefined) continue;
      if (index <= previousIndex) {
        fail(`elements of ${where} reordered or repeated`);
      }
      previousIndex = index;
    }
    // A hole has no lead to read the layout from.
    let reference = count - 1;
    while (reference > 0 && before[reference].kind === K.OmittedExpression) {
      reference--;
    }
    const referenceLead =
      reference > 0 ? leadOf(before[reference], text, false) : leadFirst;
    const multiLine = BREAK.test(referenceLead.ws + referenceLead.head);
    const indent = multiLine
      ? lazy(() => lineIndentAt(text, startOf(before[reference])))
      : ownerIndent;
    const defaultJunction = multiLine ? newLine + indent() : ' ';
    const items = after.map((node, i): Item => {
      const index = own[i];
      if (index === undefined) {
        return newItem(node, listClass, slot.listClass, where, indent, newLine);
      }
      const source = before[index];
      const lead = index === 0 ? leadFirst : leadOf(source, text, false);
      return {
        index,
        kind: source.kind,
        ws: lead.ws,
        head: lead.head,
        trail:
          index === count - 1
            ? trailLast
            : trailOf(source, text, listClass.separator, false, parentEnd),
        body: source === node ? ownText(source) : editText(source, node),
      };
    });
    return {
      start: before.pos,
      end: stop,
      text: writeItems(items, listClass, {
        firstWs: listOwned + leadFirst.ws,
        junction: (item) => (item.index > 0 ? item.ws : defaultJunction),
        trailingSeparator: trailLast.hasSeparator,
        newLine,
        indent,
        closing,
        closingIndent: closeIndent,
      }),
    };
  }

  function isIdentifierTextAllowed(node: ts.Node, parent: ts.Node | undefined) {
    const text = textOfNode(node);
    // The specifier is checked as a whole.
    if (parent && parent.kind === K.ImportSpecifier) return true;
    if (
      parent &&
      nameParentKinds.has(parent.kind) &&
      childOf(parent, 'name') === node
    ) {
      return (
        PLAIN_IDENTIFIER.test(text) ||
        (parent.kind === K.PropertyAssignment &&
          /^\d+$/.test(text) &&
          Number.isSafeInteger(Number(text)) &&
          String(Number(text)) === text)
      );
    }
    // eslint's helpers write `config.rules` as one identifier.
    return DOTTED_IDENTIFIER.test(text);
  }

  // A built name can hold a whole specifier's text (`type A`, `A as B`), so the
  // text is validated by parsing it.
  const specifierValidity = new Map<string, boolean>();
  function isSpecifierValid(node: ts.ImportSpecifier): boolean {
    const name = node.name.text;
    const whole = !node.propertyName && !node.isTypeOnly;
    if (
      !whole &&
      (!PLAIN_IDENTIFIER.test(name) ||
        (node.propertyName && !PLAIN_IDENTIFIER.test(node.propertyName.text)))
    ) {
      return false;
    }
    const text = `${node.isTypeOnly ? 'type ' : ''}${
      node.propertyName ? `${node.propertyName.text} as ` : ''
    }${name}`;
    if (!specifierValidity.has(text)) {
      const sourceFile = ast.createSourceFile(
        'specifier.ts',
        `import { ${text} } from 'm';`,
        ast.ScriptTarget.Latest,
        true
      );
      const statement =
        sourceFile.statements.length === 1
          ? (sourceFile.statements[0] as ts.ImportDeclaration)
          : undefined;
      const bindings =
        statement && statement.kind === K.ImportDeclaration
          ? statement.importClause?.namedBindings
          : undefined;
      const elements =
        bindings && bindings.kind === K.NamedImports
          ? (bindings as ts.NamedImports).elements
          : undefined;
      const broken = host.hasParseErrors(sourceFile);
      specifierValidity.set(
        text,
        !!elements && elements.length === 1 && !broken
      );
    }
    return specifierValidity.get(text);
  }

  // The kinds in `builtKinds` that are only allowed in the shape Nx builds.
  function assertBuiltShape(
    node: ts.Node,
    where: string,
    parent: ts.Node | undefined
  ): void {
    const bad = (what: string) => fail(`built ${what} in ${where}`);
    if (node.kind === K.NumericLiteral) {
      const text = textOfNode(node);
      // Text that is not what `String(number)` writes re-parses to another
      // literal. TypeScript 6's factory rejects a negative one.
      if (String(Number(text)) !== text || text.startsWith('-')) {
        bad(`numeric literal ${text}`);
      }
    } else if (node.kind === K.Identifier) {
      if (!isIdentifierTextAllowed(node, parent)) {
        bad(`identifier with the text ${textOfNode(node)}`);
      }
    } else if (node.kind === K.ImportSpecifier) {
      const specifier = node as ts.ImportSpecifier;
      if (!isSpecifierValid(specifier)) {
        bad(
          `import specifier ${
            specifier.propertyName ? `${specifier.propertyName.text} as ` : ''
          }${specifier.name.text}`
        );
      }
    } else if (node.kind === K.PrefixUnaryExpression) {
      const unary = node as ts.PrefixUnaryExpression;
      if (
        unary.operator !== K.MinusToken ||
        unary.operand.kind !== K.NumericLiteral
      ) {
        bad('unary expression other than a negative number');
      }
    } else if (node.kind === K.AwaitExpression) {
      if (childOf(node, 'expression').kind !== K.CallExpression) {
        bad('await of something other than a call');
      }
    } else if (node.kind === K.ParenthesizedExpression) {
      if (childOf(node, 'expression').kind !== K.ObjectLiteralExpression) {
        bad('parentheses around something other than an object literal');
      }
    } else if (node.kind === K.ArrowFunction) {
      const arrow = node as ts.ArrowFunction;
      if (
        (arrow.modifiers && arrow.modifiers.length) ||
        (arrow.typeParameters && arrow.typeParameters.length) ||
        arrow.type ||
        (arrow.body.kind !== K.ParenthesizedExpression &&
          arrow.body.kind !== K.ObjectLiteralExpression)
      ) {
        bad('arrow function other than (params) => ({...})');
      }
      for (const parameter of arrow.parameters) {
        if (
          (parameter.modifiers && parameter.modifiers.length) ||
          parameter.dotDotDotToken ||
          parameter.questionToken ||
          parameter.type ||
          parameter.initializer ||
          parameter.name.kind !== K.Identifier
        ) {
          bad('arrow function parameter other than a name');
        }
      }
    } else if (
      node.kind === K.CallExpression ||
      node.kind === K.PropertyAccessExpression ||
      node.kind === K.ElementAccessExpression
    ) {
      if (
        childOf(node, 'questionDotToken') ||
        (node.flags ?? 0) & ops.optionalChain
      ) {
        bad('optional chain');
      }
      const base = childOf(node, 'expression');
      if (!calleeKinds.has(base.kind)) {
        bad(`${kindName(node.kind)} on a ${kindName(base.kind)}`);
      }
    }
  }

  function addSyntheticLeadingComment<T extends ts.Node>(
    node: T,
    kind: ts.SyntaxKind,
    text: string,
    _hasTrailingNewLine?: boolean
  ): T {
    if (kind !== K.SingleLineCommentTrivia) {
      fail('a leading comment that is not a // comment');
    }
    if (isParsed(node)) fail('a leading comment on a parsed node');
    if (BREAK.test(text)) fail('a leading comment with a line break');
    const comments = leadingComments.get(node) ?? [];
    comments.push(`//${text}`);
    leadingComments.set(node, comments);
    return node;
  }

  const isLiteral = (node: ts.Node) =>
    node.kind === K.ObjectLiteralExpression ||
    node.kind === K.ArrayLiteralExpression;
  const elementsOf = (node: ts.Node) =>
    listOf(
      node,
      node.kind === K.ObjectLiteralExpression ? 'properties' : 'elements'
    );

  function commentedElements(node: ts.Node): ts.Node[] {
    if (isParsed(node) || !isLiteral(node)) return [];
    const elements = [...elementsOf(node)];
    const commented = elements.filter((e) => leadingComments.has(e));
    if (
      commented.length &&
      (!(node as ts.ObjectLiteralExpression & { multiLine?: boolean })
        .multiLine ||
        elements.some(isParsed))
    ) {
      fail(COMMENT_PLACE);
    }
    return commented;
  }

  // The native printer puts the placeholder element on its own line, at the
  // commented element's indentation. The comment lines then take its place.
  function withCommentSlots(
    node: ts.Node,
    rewritten: ts.Node,
    newName: () => string,
    units: Unit[]
  ): ts.Node {
    const isObject = node.kind === K.ObjectLiteralExpression;
    const listClass = isObject ? listClasses.objectMember : listClasses.expr;
    const out: ts.Node[] = [];
    const now = [...elementsOf(rewritten)];
    [...elementsOf(node)].forEach((element, i) => {
      if (leadingComments.has(element)) {
        const name = newName();
        units.push({ names: [name], comment: leadingComments.get(element) });
        out.push(listClass.placeholder(name));
      }
      out.push(now[i]);
    });
    return isObject ? ops.objectLiteral(out) : ops.arrayLiteral(out);
  }

  function commentText(
    printed: string,
    unit: Unit,
    indent: string,
    aloneOnLine: boolean,
    newLine: string
  ): string {
    if (!aloneOnLine || printed[unit.end] !== ',') fail(COMMENT_PLACE);
    return unit.comment.join(newLine + indent);
  }

  // TypeScript 7.1's printer writes `new (a().c)()` as `new a().c()`.
  // TypeScript 6's factory already added the parentheses.
  function withCalleeParentheses(node: ts.Node): ts.Node {
    if (node.kind !== K.NewExpression) return node;
    const callee = childOf(node, 'expression');
    let base = callee;
    while (chainLinkKinds.has(base.kind)) base = childOf(base, 'expression');
    if (base.kind !== K.CallExpression) return node;
    return ops.newExpression(
      ops.parenthesized(callee),
      listOf(node, 'typeArguments'),
      listOf(node, 'arguments')
    );
  }

  function printBuiltNode(node: ts.Node): string {
    for (let attempt = 0; ; attempt++) {
      const tag = `__nx_c${tagCount++}_`;
      let names = 0;
      const units: Unit[] = [];
      const placed = new Set<ts.Node>();
      const rewrite = (current: ts.Node): ts.Node => {
        if (leadingComments.has(current) && !placed.has(current)) {
          fail(COMMENT_PLACE);
        }
        const commented = commentedElements(current);
        for (const element of commented) placed.add(element);
        const rewritten = withCalleeParentheses(
          ops.visitEachChild(current, rewrite)
        );
        return commented.length
          ? withCommentSlots(
              current,
              rewritten,
              () => `${tag}${names++}_`,
              units
            )
          : rewritten;
      };
      const printed = ops.print(rewrite(node));
      if (names === 0) return printed;
      const pattern = new RegExp(`${tag}\\d+_`, 'g');
      const found: RegExpExecArray[] = [];
      for (let match = pattern.exec(printed); match;) {
        found.push(match);
        match = pattern.exec(printed);
      }
      // Built text can hold the placeholder name: print again under a new one.
      if (found.length !== names) {
        if (attempt > 5) fail('placeholder collision');
        continue;
      }
      const unitByName = new Map(units.map((unit) => [unit.names[0], unit]));
      const parts: string[] = [];
      let pos = 0;
      for (const match of found) {
        const unit = unitByName.get(match[0]);
        unit.end = match.index + match[0].length;
        const lineStart = printed.lastIndexOf('\n', match.index - 1) + 1;
        const indent = printed.slice(lineStart, match.index);
        parts.push(
          printed.slice(pos, match.index),
          commentText(
            printed,
            unit,
            indent,
            /^[ \t]*$/.test(indent) && lineStart > 0,
            '\n'
          )
        );
        pos = unit.end + 1;
      }
      parts.push(printed.slice(pos));
      return parts.join('');
    }
  }

  // Prints a built node whose lists may hold parsed elements. Each such list
  // is printed as placeholders and then written by `writeItems`.
  function printWithParsedElements(
    built: ts.Node,
    where: string,
    indent: Lazy<string>,
    newLine: string
  ): string {
    const rootSource = updateSourceOf(built);
    if (rootSource) {
      assertUpdateSourceInReach(rootSource, where);
      return editText(rootSource, built);
    }
    for (let attempt = 0; ; attempt++) {
      const tag = `__nx_${tagCount++}_`;
      let names = 0;
      const units: Unit[] = [];
      const replacements = new Map<ts.Node, ts.Node>();
      const seen = new Set<ts.Node>();
      const commentPlaced = new Set<ts.Node>();
      const commentHosts = new Set<ts.Node>();
      const collect = (
        node: ts.Node,
        slotWhere: string,
        parent: ts.Node | undefined
      ): void => {
        if (isParsed(node)) {
          fail(
            `built ${slotWhere} holds a parsed ${kindName(node.kind)} outside a list`
          );
        }
        if (leadingComments.has(node) && !commentPlaced.has(node)) {
          fail(COMMENT_PLACE);
        }
        const commented = commentedElements(node);
        if (commented.length) {
          commentHosts.add(node);
          for (const element of commented) commentPlaced.add(element);
        }
        // A node that became a placeholder cannot also print elsewhere.
        if (replacements.has(node)) {
          fail(`the built node holds the same ${kindName(node.kind)} twice`);
        }
        seen.add(node);
        const source = node === built ? undefined : updateSourceOf(node);
        if (source && builtKinds.has(node.kind)) {
          assertUpdateSourceInReach(source, slotWhere);
          const name = `${tag}${names++}_`;
          units.push({
            names: [name],
            update: { source, updated: node },
          });
          replacements.set(node, ops.identifier(name));
          return;
        }
        if (!builtKinds.has(node.kind)) {
          fail(`built ${kindName(node.kind)} in ${slotWhere}`);
        }
        assertBuiltShape(node, slotWhere, parent);
        const row = rowByKind.get(node.kind);
        if (!row) {
          const name = kindName(node.kind);
          ast.forEachChild(
            node,
            (c) => collect(c, name, node),
            (cs) => {
              for (const c of cs) collect(c, name, node);
            }
          );
          return;
        }
        for (const slot of row.slots) {
          const value = slotValue(node, slot.name);
          if (!value) continue;
          const slotName = `${kindName(node.kind)}.${slot.name}`;
          if (slot.kind === 'child') {
            collect(value as ts.Node, slotName, node);
            continue;
          }
          const elements = [...(value as NodeList)];
          if (!elements.some(isParsed)) {
            for (const element of elements) collect(element, slotName, node);
            continue;
          }
          if (!slot.listClass) fail(`built ${slotName} holds parsed code`);
          const listClass = listClasses[slot.listClass];
          const unit: Unit = {
            names: [],
            list: {
              listClass,
              className: slot.listClass,
              where: slotName,
              elements,
            },
          };
          for (const element of elements) {
            if (seen.has(element) || replacements.has(element)) {
              fail(
                `the built node holds the same ${kindName(element.kind)} twice`
              );
            }
            const name = `${tag}${names++}_`;
            unit.names.push(name);
            replacements.set(element, listClass.placeholder(name));
          }
          units.push(unit);
        }
      };
      collect(built, where, undefined);
      const rewrite = (node: ts.Node): ts.Node => {
        if (replacements.has(node)) return replacements.get(node);
        const rewritten = ops.visitEachChild(node, rewrite);
        return commentHosts.has(node)
          ? withCommentSlots(node, rewritten, () => `${tag}${names++}_`, units)
          : rewritten;
      };
      let printed = ops.print(
        names === 0 && commentHosts.size === 0 ? built : rewrite(built)
      );
      if (names === 0) {
        return printed.includes('\n')
          ? printed.replace(/\n/g, newLine + indent())
          : printed;
      }
      const pattern = new RegExp(`${tag}\\d+_`, 'g');
      let count = 0;
      while (pattern.exec(printed)) count++;
      // Built text can hold the placeholder name: print again under a new one.
      if (count !== names) {
        if (attempt > 5) fail('placeholder collision');
        continue;
      }
      if (printed.includes('\n')) {
        printed = printed.replace(/\n/g, newLine + indent());
      }
      const found = new Map<string, number>();
      pattern.lastIndex = 0;
      for (let match = pattern.exec(printed); match;) {
        found.set(match[0], match.index);
        match = pattern.exec(printed);
      }
      for (const unit of units) {
        unit.start = found.get(unit.names[0]);
        const lastName = unit.names[unit.names.length - 1];
        unit.end = found.get(lastName) + lastName.length;
      }
      units.sort((x, y) => x.start - y.start);
      // Filled text is never searched again, so it may hold a placeholder
      // name.
      const parts: string[] = [];
      let pos = 0;
      let lineStart = 0;
      let lineIndent = '';
      let aloneOnLine = false;
      for (const unit of units) {
        const segment = printed.slice(pos, unit.start);
        const lineBreak = Math.max(
          segment.lastIndexOf('\n'),
          segment.lastIndexOf('\r')
        );
        if (lineBreak >= 0) {
          lineStart = pos + lineBreak + 1;
          lineIndent = segment.slice(lineBreak + 1);
          aloneOnLine = /^[ \t]*$/.test(lineIndent);
        } else {
          aloneOnLine = false;
        }
        parts.push(segment);
        if (unit.comment) {
          parts.push(
            commentText(
              printed,
              unit,
              lineIndent,
              aloneOnLine && lineStart > 0,
              newLine
            )
          );
          pos = unit.end + 1;
          continue;
        }
        if (unit.update) {
          parts.push(editText(unit.update.source, unit.update.updated));
          pos = unit.end;
          continue;
        }
        const multiLine = aloneOnLine;
        const start = lineStart;
        const indentOfLine = lazy(() => {
          let end = start;
          while (printed[end] === ' ' || printed[end] === '\t') end++;
          return printed.slice(start, end);
        });
        const itemIndentText = lineIndent;
        const itemIndent = multiLine ? () => itemIndentText : indentOfLine;
        const { listClass, className, where: listWhere, elements } = unit.list;
        const items = elements.map((element) =>
          newItem(element, listClass, className, listWhere, itemIndent, newLine)
        );
        parts.push(
          writeItems(items, listClass, {
            firstWs: '',
            junction: () => (multiLine ? newLine + itemIndent() : ' '),
            trailingSeparator: false,
            newLine,
            indent: itemIndent,
            closing: '',
            closingIndent: indentOfLine,
            afterBreak: isBreak(printed.charCodeAt(unit.end)),
          })
        );
        pos = unit.end;
      }
      parts.push(printed.slice(pos));
      return parts.join('');
    }
  }

  const inputHasParseErrors = new WeakMap<ts.SourceFile, boolean>();
  function assertOutputParses(original: ts.Node, replacement: string): void {
    const sourceFile = fileOf(original);
    if (!inputHasParseErrors.has(sourceFile)) {
      inputHasParseErrors.set(sourceFile, host.hasParseErrors(sourceFile));
    }
    // The tree of a file with syntax errors is a guess already.
    if (inputHasParseErrors.get(sourceFile)) return;
    const text = sourceFile.text;
    const start = startOf(original);
    const output = ast.createSourceFile(
      sourceFile.fileName,
      text.slice(0, start) + replacement + text.slice(original.end),
      ast.ScriptTarget.Latest,
      true,
      (sourceFile as ts.SourceFile & { scriptKind?: ts.ScriptKind }).scriptKind
    );
    if (host.hasParseErrors(output)) {
      let line = 1;
      for (let i = 0; i < start; i++) {
        const c = text.charCodeAt(i);
        if (c === 10 || (c === 13 && text.charCodeAt(i + 1) !== 10)) line++;
      }
      fail(
        `the printed output does not parse (${kindName(original.kind)} at line ${line})`
      );
    }
  }

  function printUpdate(original: ts.Node, updated: ts.Node): string {
    if (original.parent === undefined) {
      fail(
        original.kind === K.SourceFile
          ? 'the original is a SourceFile'
          : 'the original node has no parent; parse with parent pointers'
      );
    }
    if (updated === original) return ownText(original);
    if (isParsed(updated)) fail('the updated node is another parsed node');
    root = original;
    if (updated.kind === original.kind && rowByKind.has(original.kind)) {
      return editText(original, updated);
    }
    // A variable statement starts with a keyword, so it cannot continue the
    // statement before it.
    if (
      updated.kind === K.VariableStatement &&
      original.kind === K.VariableStatement &&
      statementParentKinds.has(original.parent.kind)
    ) {
      const modifiers = listOf(updated, 'modifiers');
      if (modifiers && modifiers.length) {
        fail('a built variable statement with modifiers');
      }
      const text = textOf(original);
      return printWithParsedElements(
        updated,
        'the built variable statement',
        lazy(() => lineIndentAt(text, startOf(original))),
        newLineOf(text)
      );
    }
    return fail(
      `the replacement of a ${kindName(original.kind)} by a ${
        updated.kind === original.kind ? 'built' : 'different'
      } ${kindName(updated.kind)}`
    );
  }

  return {
    printNodeUpdate(original, updated) {
      const replacement = printUpdate(original, updated);
      assertOutputParses(original, replacement);
      return replacement;
    },
    printBuiltNode,
    addSyntheticLeadingComment,
  };
}

function createBackendOps(backend: TypescriptBackend): BackendOps {
  switch (backend.kind) {
    case 'classic': {
      const { ts: tsModule } = backend;
      const { factory } = tsModule;
      const printer = tsModule.createPrinter({
        newLine: tsModule.NewLineKind.LineFeed,
      });
      return {
        optionalChain: tsModule.NodeFlags.OptionalChain,
        print: (node) =>
          printer.printNode(tsModule.EmitHint.Unspecified, node, undefined),
        visitEachChild: (node, visit) =>
          tsModule.visitEachChild(node, visit, undefined),
        identifier: (name) => factory.createIdentifier(name),
        shorthandProperty: (name) =>
          factory.createShorthandPropertyAssignment(name),
        importSpecifier: (name) =>
          factory.createImportSpecifier(
            false,
            undefined,
            factory.createIdentifier(name)
          ),
        parenthesized: (expression) =>
          factory.createParenthesizedExpression(expression as ts.Expression),
        newExpression: (expression, typeArguments, args) =>
          factory.createNewExpression(
            expression as ts.Expression,
            typeArguments as ts.NodeArray<ts.TypeNode> | undefined,
            args as ts.NodeArray<ts.Expression> | undefined
          ),
        objectLiteral: (properties) =>
          factory.createObjectLiteralExpression(
            properties as ts.ObjectLiteralElementLike[],
            true
          ),
        arrayLiteral: (elements) =>
          factory.createArrayLiteralExpression(
            elements as ts.Expression[],
            true
          ),
      };
    }
    case 'api':
      return createApiBackendOps(backend);
    default:
      return unhandledTypescriptBackend(backend);
  }
}

function createApiBackendOps(backend: ApiTypescriptBackend): BackendOps {
  const { factory } = backend;
  const visitor: TypescriptAstVisitorModule = require(
    resolveInstalledPackage('typescript/ast/visitor', [
      ...getNxRequirePaths(),
      __dirname,
    ])
  );
  const identifier = (name: string) => factory.createIdentifier(name);
  return {
    optionalChain: backend.ast.NodeFlags.OptionalChain,
    print: (node) =>
      withTypescriptApi(backend, (api) => api.printer.printNode(node as never)),
    visitEachChild: (node, visit) =>
      visitor.visitEachChild(node as never, visit as never) as never,
    identifier: (name) => identifier(name) as never,
    shorthandProperty: (name) =>
      factory.createShorthandPropertyAssignment(
        undefined,
        identifier(name),
        undefined,
        undefined,
        undefined,
        undefined
      ) as never,
    importSpecifier: (name) =>
      factory.createImportSpecifier(
        false,
        undefined,
        identifier(name)
      ) as never,
    parenthesized: (expression) =>
      factory.createParenthesizedExpression(expression as never) as never,
    newExpression: (expression, typeArguments, args) =>
      factory.createNewExpression(
        expression as never,
        typeArguments as never,
        args as never
      ) as never,
    objectLiteral: (properties) =>
      factory.createObjectLiteralExpression(properties as never, true) as never,
    arrayLiteral: (elements) =>
      factory.createArrayLiteralExpression(elements as never, true) as never,
  };
}
