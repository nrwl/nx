import {
  applyChangesToString,
  ChangeType,
  formatFiles,
  visitNotIgnoredFiles,
  type StringChange,
  type Tree,
} from '@nx/devkit';
import { ensureTypescript } from '@nx/js/internal';
import type {
  CallExpression,
  Expression,
  Identifier,
  Node,
  ObjectLiteralElementLike,
  ObjectLiteralExpression,
  SourceFile,
  Symbol as TsSymbol,
  TypeChecker,
} from 'typescript';

const HIGHLIGHT_MODULE = 'storybook/highlight';
// The value of the `HIGHLIGHT` constant.
const HIGHLIGHT_EVENT = 'storybook/highlight/add';
const HIGHLIGHT_DOCS =
  'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#highlight-menu-items-emit-a-fixed-highlight_menu_click-event-with-a-mandatory-id';
const SOURCE_FILE_PATTERN = /\.[cm]?[jt]sx?$/;
// Story and docs formats whose scripts can use Highlight but aren't parsed here.
const UNPARSED_FILE_PATTERN = /\.(mdx|svelte|vue)$/;
const LISTENER_METHODS = new Set([
  'on',
  'once',
  'off',
  'addListener',
  'removeListener',
  'removeAllListeners',
]);
const CHANGED_TYPES = new Set(['HighlightOptions', 'ClickEventDetails']);
const LEADING_NEWLINE = /[ \t]*(\r?\n[ \t]*)/y;

type HighlightImports = {
  events: Set<string>;
  namespaces: Set<string>;
  types: Set<string>;
  bindings: Identifier[];
};

let ts: typeof import('typescript') | undefined;

export default async function addHighlightIds(tree: Tree) {
  let rewritten = false;
  const pending: string[] = [];

  // Stories, decorators, preview files and addons can all emit highlights, so
  // the whole workspace is scanned.
  visitNotIgnoredFiles(tree, '.', (filePath) => {
    const parsable = SOURCE_FILE_PATTERN.test(filePath);
    if (!parsable && !UNPARSED_FILE_PATTERN.test(filePath)) {
      return;
    }
    const content = tree.read(filePath, 'utf-8');
    const referencesHighlight = content.includes(HIGHLIGHT_MODULE);
    if (!referencesHighlight && !content.includes('clickEvent')) {
      return;
    }

    const result = parsable ? migrateFile(filePath, content) : undefined;
    if (!result) {
      if (referencesHighlight) {
        pending.push(
          `${filePath} uses "${HIGHLIGHT_MODULE}" in a file this migration can't parse. Give each HIGHLIGHT payload it emits a unique string "id", and replace "clickEvent" in its menu items as described in ${HIGHLIGHT_DOCS}.`
        );
      }
      return;
    }
    if (result.content !== content) {
      tree.write(filePath, result.content);
      rewritten = true;
    }
    pending.push(...result.notes);
  });

  if (rewritten) {
    await formatFiles(tree);
  }
  if (pending.length === 0) {
    return { skipAgentic: true };
  }

  return { nextSteps: pending, agentContext: pending };
}

function migrateFile(
  filePath: string,
  content: string
): { content: string; notes: string[] } | undefined {
  ts ??= ensureTypescript();
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true
  );
  if (
    (sourceFile as { parseDiagnostics?: unknown[] }).parseDiagnostics?.length
  ) {
    return undefined;
  }

  const imports = readHighlightImports(sourceFile);
  let checker: TypeChecker | undefined;
  const getChecker = () => (checker ??= createChecker(sourceFile));
  const isImportBinding = createImportBindingCheck(
    getChecker,
    imports.bindings
  );
  const emitters = new Set<string>();
  const eventCalls: CallExpression[] = [];
  const possibleMenuItems: ObjectLiteralExpression[] = [];
  const notes: string[] = [];
  const lineOf = (node: Node) =>
    sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line +
    1;

  const visit = (node: Node): void => {
    if (
      ts.isCallExpression(node) &&
      node.arguments.length > 0 &&
      isHighlightEvent(node.arguments[0], imports, isImportBinding)
    ) {
      eventCalls.push(node);
    } else if (
      isHighlightEvent(node, imports, isImportBinding) &&
      !isEventArgument(node) &&
      // `useChannel({ [HIGHLIGHT]: ... })` listens to the event.
      !ts.isComputedPropertyName(node.parent)
    ) {
      notes.push(
        `${filePath}:${lineOf(node)} uses HIGHLIGHT outside an emit call, so the payloads emitted through it were not checked. Give each one a unique string "id".`
      );
    } else if (
      ts.isStringLiteralLike(node) &&
      node.text === HIGHLIGHT_MODULE &&
      !ts.isImportDeclaration(node.parent) &&
      !ts.isModuleDeclaration(node.parent)
    ) {
      notes.push(
        `${filePath}:${lineOf(node)} loads "${HIGHLIGHT_MODULE}" in a way this migration doesn't read, such as a require, a dynamic import or a re-export. Give each HIGHLIGHT payload emitted through it a unique string "id".`
      );
    } else if (ts.isObjectLiteralExpression(node) && isPossibleMenuItem(node)) {
      possibleMenuItems.push(node);
    } else if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      getStaticName(node.initializer.expression) === 'useChannel'
    ) {
      emitters.add(node.name.text);
    } else if (
      ts.isQualifiedName(node) &&
      ts.isIdentifier(node.left) &&
      imports.namespaces.has(node.left.text) &&
      CHANGED_TYPES.has(node.right.text)
    ) {
      imports.types.add(node.right.text);
    }

    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  // A fixed id would make a repeated emit replace the earlier highlight.
  const id = `\`${escapeTemplateText(filePath)}-\${Math.random().toString(36).slice(2)}\``;
  const changes: StringChange[] = [];
  const menuItems = new Set<ObjectLiteralExpression>();
  for (const call of eventCalls) {
    const callee = call.expression;
    const calleeName = getStaticName(callee);
    if (calleeName && LISTENER_METHODS.has(calleeName)) {
      continue;
    }
    if (
      calleeName !== 'emit' &&
      !(ts.isIdentifier(callee) && emitters.has(callee.text))
    ) {
      notes.push(
        `${filePath}:${lineOf(call)} passes HIGHLIGHT to "${callee.getText(sourceFile)}", which this migration doesn't recognize as an emit. If it emits the event, give the payload a unique string "id".`
      );
      continue;
    }
    const payload = call.arguments[1];
    if (!payload) {
      continue;
    }
    if (ts.isSpreadElement(payload)) {
      notes.push(
        `${filePath}:${lineOf(call)} passes the HIGHLIGHT payload through a spread argument, so it was not checked. Give it a unique string "id".`
      );
      continue;
    }
    const literal = skipOuterExpressions(payload);
    if (!ts.isObjectLiteralExpression(literal)) {
      notes.push(
        `${filePath}:${lineOf(payload)} emits a HIGHLIGHT payload that isn't an object literal, so it was not checked. Make sure it has a unique string "id".`
      );
      continue;
    }
    const { clickEventItems, complete } = readMenu(literal);
    clickEventItems.forEach((item) => menuItems.add(item));
    if (!complete) {
      notes.push(
        `${filePath}:${lineOf(payload)} emits a HIGHLIGHT payload whose menu items come from code this migration doesn't follow, so they were not checked for "clickEvent". Follow the menu to its items and replace "clickEvent" on any that use it, as described in ${HIGHLIGHT_DOCS}.`
      );
    }
    // Storybook still gives a legacy `elements` payload an id itself.
    if (findStaticKey(literal, 'elements')) {
      continue;
    }
    const idSource = findKeySource(literal, 'id');
    if (!idSource) {
      if (hasLocalMath(getChecker(), literal)) {
        notes.push(
          `${filePath}:${lineOf(payload)} emits a HIGHLIGHT payload where "Math" is a local binding, so the generated id, which calls Math.random(), was not added. Give it a unique string "id".`
        );
      } else {
        changes.push(insertIdProperty(literal, id, sourceFile));
      }
    } else if (!hasNonEmptyStringId(idSource)) {
      notes.push(
        `${filePath}:${lineOf(payload)} emits a HIGHLIGHT payload whose "id" may not be a non-empty string, so it was not changed. Make sure it has a unique, non-empty string "id".`
      );
    }
  }
  if (menuItems.size > 0) {
    notes.push(
      `${filePath} has Highlight menu items that use "clickEvent" (${formatLines([...menuItems].map(lineOf))}), which Storybook no longer emits. Set "clickable: true" on them, give their HIGHLIGHT payload a fixed "id", and move the "clickEvent" listener to HIGHLIGHT_MENU_CLICK, which passes the highlight id, the menu item id and the click details. See ${HIGHLIGHT_DOCS}.`
    );
  }
  const otherItems = possibleMenuItems.filter((item) => !menuItems.has(item));
  if (otherItems.length > 0) {
    notes.push(
      `${filePath} has objects with "title" and "clickEvent" (${formatLines(otherItems.map(lineOf))}) that may be Highlight menu items. Change only the ones that reach the menu of a HIGHLIGHT payload: set "clickable: true", give that payload a fixed "id", and move the "clickEvent" listener to HIGHLIGHT_MENU_CLICK. Leave the others unchanged. See ${HIGHLIGHT_DOCS}.`
    );
  }
  if (imports.types.has('HighlightOptions')) {
    notes.push(
      `${filePath} uses the HighlightOptions type, which now requires "id". Give each object of that type a unique string "id".`
    );
  }
  if (imports.types.has('ClickEventDetails')) {
    notes.push(
      `${filePath} uses the ClickEventDetails type, whose "element" no longer has "outerHTML" or "attributes". Read "tagName", "localName" or the matching "selectors" instead.`
    );
  }

  return { content: applyChangesToString(content, changes), notes };
}

function readHighlightImports(sourceFile: SourceFile): HighlightImports {
  const imports: HighlightImports = {
    events: new Set(),
    namespaces: new Set(),
    types: new Set(),
    bindings: [],
  };
  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== HIGHLIGHT_MODULE
    ) {
      continue;
    }
    const bindings = statement.importClause?.namedBindings;
    if (!bindings) {
      continue;
    }
    if (ts.isNamespaceImport(bindings)) {
      imports.namespaces.add(bindings.name.text);
      imports.bindings.push(bindings.name);
      continue;
    }
    for (const element of bindings.elements) {
      const imported = (element.propertyName ?? element.name).text;
      if (imported === 'HIGHLIGHT') {
        imports.events.add(element.name.text);
        imports.bindings.push(element.name);
      } else if (CHANGED_TYPES.has(imported)) {
        imports.types.add(imported);
      }
    }
  }
  return imports;
}

function isHighlightEvent(
  node: Node,
  imports: HighlightImports,
  isImportBinding: (identifier: Identifier) => boolean
): boolean {
  if (ts.isIdentifier(node)) {
    return (
      imports.events.has(node.text) &&
      !isNamePosition(node) &&
      isImportBinding(node)
    );
  }
  if (ts.isStringLiteralLike(node)) {
    return node.text === HIGHLIGHT_EVENT && !isNamePosition(node);
  }
  if (
    ts.isPropertyAccessExpression(node) ||
    ts.isElementAccessExpression(node)
  ) {
    return (
      ts.isIdentifier(node.expression) &&
      imports.namespaces.has(node.expression.text) &&
      getStaticName(node) === 'HIGHLIGHT' &&
      isImportBinding(node.expression)
    );
  }
  return false;
}

// A local variable can reuse an imported name, so names are compared by the
// symbol the checker binds them to.
function createImportBindingCheck(
  getChecker: () => TypeChecker,
  bindings: Identifier[]
): (identifier: Identifier) => boolean {
  let importSymbols: Set<TsSymbol | undefined> | undefined;
  return (identifier) => {
    const checker = getChecker();
    importSymbols ??= new Set(
      bindings.map((binding) => checker.getSymbolAtLocation(binding))
    );
    const symbol = ts.isShorthandPropertyAssignment(identifier.parent)
      ? checker.getShorthandAssignmentValueSymbol(identifier.parent)
      : checker.getSymbolAtLocation(identifier);
    return symbol !== undefined && importSymbols.has(symbol);
  };
}

function createChecker(sourceFile: SourceFile): TypeChecker {
  const fileName = sourceFile.fileName;
  return ts
    .createProgram(
      [fileName],
      { noLib: true, noResolve: true, allowJs: true, types: [] },
      {
        getSourceFile: (name) => (name === fileName ? sourceFile : undefined),
        getDefaultLibFileName: () => 'lib.d.ts',
        writeFile: () => {},
        getCurrentDirectory: () => '',
        getCanonicalFileName: (name) => name,
        useCaseSensitiveFileNames: () => true,
        getNewLine: () => '\n',
        fileExists: (name) => name === fileName,
        readFile: () => undefined,
      }
    )
    .getTypeChecker();
}

// Without lib files the global `Math` has no symbol, so any match is a local
// binding. Type-only imports count: TypeScript rejects them in value position.
function hasLocalMath(checker: TypeChecker, node: Node): boolean {
  return checker
    .getSymbolsInScope(node, ts.SymbolFlags.Value | ts.SymbolFlags.Alias)
    .some((symbol) => symbol.name === 'Math');
}

function isNamePosition(node: Node): boolean {
  const parent = node.parent as Node & { name?: Node; propertyName?: Node };
  return (
    !ts.isShorthandPropertyAssignment(parent) &&
    (parent.name === node || parent.propertyName === node)
  );
}

function isEventArgument(node: Node): boolean {
  return ts.isCallExpression(node.parent) && node.parent.arguments[0] === node;
}

function getStaticName(node: Node): string | undefined {
  if (ts.isIdentifier(node) || ts.isStringLiteralLike(node)) {
    return node.text;
  }
  if (ts.isPropertyAccessExpression(node)) {
    return node.name.text;
  }
  if (ts.isElementAccessExpression(node)) {
    return ts.isStringLiteralLike(node.argumentExpression)
      ? node.argumentExpression.text
      : undefined;
  }
  if (ts.isComputedPropertyName(node)) {
    return ts.isStringLiteralLike(node.expression)
      ? node.expression.text
      : undefined;
  }
  return undefined;
}

function findStaticKey(
  literal: ObjectLiteralExpression,
  key: string
): ObjectLiteralElementLike | undefined {
  return literal.properties.find(
    (property) =>
      property.name !== undefined && getStaticName(property.name) === key
  );
}

function skipOuterExpressions(expression: Expression): Expression {
  let current = expression;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isNonNullExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

// Returns the last property that can set `key` at runtime: a spread, a `key`
// property or a computed key that isn't a string literal.
function findKeySource(
  literal: ObjectLiteralExpression,
  key: string
): ObjectLiteralElementLike | undefined {
  let source: ObjectLiteralElementLike | undefined;
  for (const property of literal.properties) {
    if (ts.isSpreadAssignment(property)) {
      source = property;
      continue;
    }
    const name = getStaticName(property.name);
    if (
      name === key ||
      (name === undefined && ts.isComputedPropertyName(property.name))
    ) {
      source = property;
    }
  }
  return source;
}

// `complete` is false when a menu item, or the `clickEvent` it sets, can come
// from code other than the literals in the payload.
function readMenu(payload: ObjectLiteralExpression): {
  clickEventItems: ObjectLiteralExpression[];
  complete: boolean;
} {
  const clickEventItems: ObjectLiteralExpression[] = [];
  const menuSource = findKeySource(payload, 'menu');
  if (!menuSource) {
    return { clickEventItems, complete: true };
  }
  if (
    !ts.isPropertyAssignment(menuSource) ||
    getStaticName(menuSource.name) !== 'menu'
  ) {
    return { clickEventItems, complete: false };
  }
  const menu = skipOuterExpressions(menuSource.initializer);
  if (!ts.isArrayLiteralExpression(menu)) {
    return { clickEventItems, complete: false };
  }
  let complete = true;
  for (const group of menu.elements) {
    const groupLiteral = skipOuterExpressions(group);
    if (!ts.isArrayLiteralExpression(groupLiteral)) {
      complete = false;
      continue;
    }
    for (const item of groupLiteral.elements) {
      const itemLiteral = skipOuterExpressions(item);
      if (!ts.isObjectLiteralExpression(itemLiteral)) {
        complete = false;
        continue;
      }
      if (findStaticKey(itemLiteral, 'clickEvent')) {
        clickEventItems.push(itemLiteral);
      }
      const clickEventSource = findKeySource(itemLiteral, 'clickEvent');
      if (
        clickEventSource &&
        (ts.isSpreadAssignment(clickEventSource) ||
          getStaticName(clickEventSource.name) !== 'clickEvent')
      ) {
        complete = false;
      }
    }
  }
  return { clickEventItems, complete };
}

// Storybook types `clickEvent` as an event name, so a function value rules out
// a menu item.
function isPossibleMenuItem(literal: ObjectLiteralExpression): boolean {
  const clickEvent = findStaticKey(literal, 'clickEvent');
  if (
    !clickEvent ||
    !findStaticKey(literal, 'title') ||
    ts.isMethodDeclaration(clickEvent)
  ) {
    return false;
  }
  if (!ts.isPropertyAssignment(clickEvent)) {
    return true;
  }
  const value = skipOuterExpressions(clickEvent.initializer);
  return !ts.isArrowFunction(value) && !ts.isFunctionExpression(value);
}

function formatLines(lines: number[]): string {
  return `line${lines.length > 1 ? 's' : ''} ${lines.join(', ')}`;
}

function hasNonEmptyStringId(property: ObjectLiteralElementLike): boolean {
  if (
    !ts.isPropertyAssignment(property) ||
    getStaticName(property.name) !== 'id'
  ) {
    return false;
  }
  const value = skipOuterExpressions(property.initializer);
  if (ts.isStringLiteralLike(value)) {
    return value.text !== '';
  }
  return (
    ts.isTemplateExpression(value) &&
    (value.head.text !== '' ||
      value.templateSpans.some((span) => span.literal.text !== ''))
  );
}

function insertIdProperty(
  literal: ObjectLiteralExpression,
  id: string,
  sourceFile: SourceFile
): StringChange {
  const content = sourceFile.text;
  const index = literal.getStart(sourceFile) + 1;
  LEADING_NEWLINE.lastIndex = index;
  const newline = LEADING_NEWLINE.exec(content)?.[1];
  const text = newline
    ? `${newline}id: ${id},`
    : ` id: ${id},${/\s/.test(content[index]) ? '' : ' '}`;
  return { type: ChangeType.Insert, index, text };
}

function escapeTemplateText(text: string): string {
  return text.replace(/[`\\]|\$\{/g, (match) => `\\${match}`);
}
