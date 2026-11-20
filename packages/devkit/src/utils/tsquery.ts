/**
 * https://github.com/phenomnomnominal/tsquery (6.2.0)
 *
 * MIT License
 *
 * Copyright (c) 2023 Craig Spence
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 **/

// Changes from upstream:
// - Parses and reads nodes through `getTypescriptAst`, so it runs on the
//   workspace's TypeScript, 7.1 included.
// - Keeps only `ast`, `query` and `replace`, selectors as strings, and the
//   selector types Nx uses: no sibling, adjacent, class or field selectors.
// - `replace` returns the spliced text instead of reprinting the whole file.
// - Nth-child selectors find a node's siblings through `forEachChild`, so a
//   node in a JSDoc array has none.

import type * as esquery from 'esquery';
import type { Node, ScriptKind, SourceFile } from 'typescript';
import { getTypescriptAst, type TypescriptAst } from 'nx/src/devkit-internals';

type Properties = {
  kindName: string;
  name?: string;
  text: string;
  value?: unknown;
};

type Kinds = {
  syntaxKind: TypescriptAst['SyntaxKind'];
  names: Map<number, string>;
  identifier: number;
  literalParsers: Map<number, (properties: Properties) => unknown>;
};

type Matcher = (
  node: Node,
  selector: any,
  ancestors: Node[],
  kinds: Kinds
) => boolean;

/**
 * Parses `source` with the workspace's TypeScript, as TSX unless `scriptKind`
 * says otherwise.
 */
export function ast(
  source: string,
  fileName = '',
  scriptKind?: ScriptKind
): SourceFile {
  const ts = getTypescriptAst();
  return ts.createSourceFile(
    fileName || '',
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind ?? ts.ScriptKind.TSX
  );
}

/**
 * Returns the nodes in `code` that match `selector`, an ESQuery selector over
 * TypeScript node kinds.
 */
export function query<T extends Node = Node>(
  code: string | Node,
  selector: string
): T[] {
  const kinds = getKinds(getTypescriptAst());
  const root = isNode(code) ? code : ast(code);
  const parsedSelector = parseSelector(selector, kinds);
  const results: T[] = [];
  traverse(root, [], (node, ancestors) => {
    if (findMatches(node, parsedSelector, ancestors, kinds)) {
      results.push(node as T);
    }
  });
  return results;
}

/**
 * Returns `source` with each node matching `selector` replaced by what
 * `stringTransformer` returns for it. A `null` or `undefined` result keeps the
 * node. The rest of the text is kept as is.
 */
export function replace(
  source: string,
  selector: string,
  stringTransformer: (node: Node) => string | null | undefined
): string {
  const matches = query(source, selector);
  const replacements = matches.map((node) => stringTransformer(node));
  let result = source;
  for (let index = matches.length - 1; index >= 0; index--) {
    const replacement = replacements[index];
    if (replacement != null) {
      const match = matches[index];
      result = `${result.substring(0, match.getStart())}${replacement}${result.substring(match.getEnd())}`;
    }
  }
  return result;
}

export const tsquery = { ast, query, replace };

const kindsBySyntaxKind = new WeakMap<object, Kinds>();

function getKinds(ts: TypescriptAst): Kinds {
  const { SyntaxKind } = ts;
  let kinds = kindsBySyntaxKind.get(SyntaxKind);
  if (!kinds) {
    const names = new Map<number, string>();
    for (const name of Object.keys(SyntaxKind).filter((x) =>
      isNaN(parseInt(x, 10))
    )) {
      const value = SyntaxKind[name];
      if (!names.has(value)) {
        names.set(value, name);
      }
    }
    const literalParsers = new Map<number, (properties: Properties) => unknown>(
      [
        [SyntaxKind.FalseKeyword, () => false],
        [
          SyntaxKind.NoSubstitutionTemplateLiteral,
          (properties) => properties.text,
        ],
        [SyntaxKind.NullKeyword, () => null],
        [SyntaxKind.NumericLiteral, (properties) => +properties.text],
        [
          SyntaxKind.RegularExpressionLiteral,
          (properties) => new RegExp(properties.text),
        ],
        [SyntaxKind.StringLiteral, (properties) => properties.text],
        [SyntaxKind.TrueKeyword, () => true],
      ]
    );
    kinds = {
      syntaxKind: SyntaxKind,
      names,
      identifier: SyntaxKind.Identifier,
      literalParsers,
    };
    kindsBySyntaxKind.set(SyntaxKind, kinds);
  }
  return kinds;
}

function parseSelector(selector: string, kinds: Kinds): esquery.Selector {
  const { parse }: typeof esquery = require('esquery');
  const cleanSelector = selector
    .replace(/\n/g, '')
    .replace(/\/\*[\w\W]*\*\//g, '');
  const parsed = validate(parse(cleanSelector), kinds);
  if (!parsed) {
    throw new SyntaxError(`"${selector}" is not a valid TSQuery Selector.`);
  }
  return parsed;
}

function validate(selector: any, kinds: Kinds): esquery.Selector | null {
  if (!selector) {
    return null;
  }
  selector.selectors?.forEach((child: unknown) => validate(child, kinds));
  if (selector.left) {
    validate(selector.left, kinds);
  }
  if (selector.right) {
    validate(selector.right, kinds);
  }
  if (selector.type === 'identifier') {
    const { value } = selector;
    if (kinds.syntaxKind[value] == null) {
      throw new SyntaxError(`"${value}" is not a valid TypeScript Node kind.`);
    }
  }
  return selector;
}

function traverse(
  node: Node,
  ancestors: Node[],
  iterator: (node: Node, ancestors: Node[]) => void
): void {
  if (node.parent != null) {
    ancestors.unshift(node.parent);
  }
  iterator(node, ancestors);
  let children: readonly Node[] = [];
  try {
    // `getChildren()` reaches JSDoc nodes, which `forEachChild` skips.
    children = node.getChildren();
  } catch {
    // It throws for synthesized nodes.
    node.forEachChild((child) => traverse(child, ancestors, iterator));
  }
  children.forEach((child) => traverse(child, ancestors, iterator));
  ancestors.shift();
}

function findMatches(
  node: Node,
  selector: esquery.Selector,
  ancestors: Node[],
  kinds: Kinds
): boolean {
  const matcher = MATCHERS[selector.type];
  if (matcher) {
    return matcher(node, selector, ancestors, kinds);
  }
  throw new SyntaxError(`Unknown selector type: ${selector.type}`);
}

const propertiesByNode = new WeakMap<Node, Properties>();

function getProperties(node: Node, kinds: Kinds): Properties {
  let properties = propertiesByNode.get(node);
  if (!properties) {
    properties = {
      kindName: kinds.names.get(node.kind),
      text: hasKey(node, 'text') ? node['text'] : getTextIfNotSynthesized(node),
    };
    if (node.kind === kinds.identifier) {
      properties.name = hasKey(node, 'name') ? node['name'] : properties.text;
    }
    const parseLiteral = kinds.literalParsers.get(node.kind);
    if (parseLiteral) {
      properties.value = parseLiteral(properties);
    }
    propertiesByNode.set(node, properties);
  }
  return properties;
}

function hasKey(node: Node, property: string): boolean {
  return node[property] != null;
}

// `getText()` needs a position, which synthesized nodes don't have.
function getTextIfNotSynthesized(node: Node): string {
  return !(node.pos >= 0) ? '' : node.getText();
}

function isNode(node: unknown): node is Node {
  return !!(node as Node).getSourceFile;
}

function getPath(obj: unknown, path: string, kinds: Kinds): unknown {
  for (const key of path.split('.')) {
    if (obj == null) {
      return obj;
    }
    const properties = isNode(obj) ? getProperties(obj, kinds) : {};
    obj = key in properties ? properties[key] : obj[key];
  }
  return obj;
}

// TypeScript 7.1 nodes expose their children through prototype getters, so
// the parent's child arrays come from `forEachChild` rather than its keys.
function getChildArrays(parent: Node): readonly Node[][] {
  const arrays: Node[][] = [];
  parent.forEachChild(
    () => undefined,
    (nodes) => {
      arrays.push(nodes as unknown as Node[]);
      return undefined;
    }
  );
  return arrays;
}

const ATTRIBUTE_OPERATORS: Record<
  string,
  (obj: any, value: any, type: string) => boolean
> = {
  '=': (obj, value, type) => {
    switch (type) {
      case 'regexp':
        return typeof obj === 'string' && value.test(obj);
      case 'literal':
        return `${value}` === `${obj}`;
      case 'type':
        return value === typeof obj;
    }
  },
  '!=': (obj, value, type) => {
    switch (type) {
      case 'regexp':
        return typeof obj === 'string' && !value.test(obj);
      case 'literal':
        return `${value}` !== `${obj}`;
      case 'type':
        return value !== typeof obj;
    }
  },
  '<=': (obj, value) => obj <= value,
  '<': (obj, value) => obj < value,
  '>=': (obj, value) => obj >= value,
  '>': (obj, value) => obj > value,
};

const attribute: Matcher = (node, selector: esquery.Attribute, _, kinds) => {
  const obj = getPath(node, selector.name, kinds);
  // Bail on undefined but *not* if value is explicitly `null`.
  if (obj === undefined) {
    return false;
  }
  if (selector?.operator == null) {
    return obj != null;
  }
  if (!selector?.value) {
    return false;
  }
  const { type, value } = selector.value;
  const operator = ATTRIBUTE_OPERATORS[selector.operator];
  return operator ? operator(obj, value, type) : false;
};

const child: Matcher = (node, selector: esquery.Child, ancestors, kinds) =>
  findMatches(node, selector.right, ancestors, kinds) &&
  findMatches(ancestors[0], selector.left, ancestors.slice(1), kinds);

const descendant: Matcher = (
  node,
  selector: esquery.Descendant,
  ancestors,
  kinds
) =>
  findMatches(node, selector.right, ancestors, kinds) &&
  ancestors.some((ancestor, index) =>
    findMatches(ancestor, selector.left, ancestors.slice(index + 1), kinds)
  );

const has: Matcher = (node, selector: esquery.Has, _, kinds) => {
  let found = false;
  selector.selectors.forEach((childSelector) => {
    traverse(node, [], (childNode, ancestors) => {
      if (findMatches(childNode, childSelector, ancestors, kinds)) {
        found = true;
      }
    });
  });
  return found;
};

const identifier: Matcher = (node, selector: esquery.Identifier, _, kinds) => {
  const name = kinds.names.get(node.kind);
  return !!name && name.toLowerCase() === selector.value.toLowerCase();
};

const matches =
  (modifier: 'every' | 'some'): Matcher =>
  (node, selector: esquery.Sequence | esquery.Matches, ancestors, kinds) =>
    selector.selectors[modifier]((childSelector) =>
      findMatches(node, childSelector, ancestors, kinds)
    );

const not: Matcher = (node, selector: esquery.Negation, ancestors, kinds) =>
  !selector.selectors.some((childSelector) =>
    findMatches(node, childSelector, ancestors, kinds)
  );

function nthChildMatcher(
  getIndex: (selector: esquery.NthSelector, length: number) => number
): Matcher {
  return (node, selector: esquery.NthSelector, ancestors, kinds) => {
    const { right } = selector as { right?: esquery.Selector };
    if (right && !findMatches(node, right, ancestors, kinds)) {
      return false;
    }
    if (!node.parent) {
      return false;
    }
    return getChildArrays(node.parent).some((nodes) => {
      const index = nodes.indexOf(node);
      return index >= 0 && index === getIndex(selector, nodes.length);
    });
  };
}

const MATCHERS: Record<string, Matcher> = {
  attribute,
  child,
  compound: matches('every'),
  descendant,
  'nth-child': nthChildMatcher((selector) => selector.index.value - 1),
  'nth-last-child': nthChildMatcher(
    (selector, length) => length - selector.index.value
  ),
  has,
  identifier,
  matches: matches('some'),
  not,
  type: () => false,
  wildcard: () => true,
};
