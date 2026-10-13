import {
  applyChangesToString,
  ChangeType,
  ensurePackage,
  formatFiles,
  visitNotIgnoredFiles,
  type StringChange,
  type Tree,
} from '@nx/devkit';
import type {
  CallExpression,
  Expression,
  Identifier,
  Node,
  ObjectLiteralExpression,
  SourceFile,
} from 'typescript';

const HIGHLIGHT_MODULE = 'storybook/highlight';
// The value of the `HIGHLIGHT` constant.
const HIGHLIGHT_EVENT = 'storybook/highlight/add';
const HIGHLIGHT_DOCS =
  'https://github.com/storybookjs/storybook/blob/v10.6.2/MIGRATION.md#highlight-menu-items-emit-a-fixed-highlight_menu_click-event-with-a-mandatory-id';
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
};

type FileResult = { content: string; rewrites: number; notes: string[] };

let ts: typeof import('typescript') | undefined;

export default async function addHighlightIds(tree: Tree) {
  const rewritten: string[] = [];
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
    if (!parsable) {
      if (referencesHighlight) {
        pending.push(
          `${filePath} uses "${HIGHLIGHT_MODULE}" in a file this migration can't parse. Give each HIGHLIGHT payload it emits a unique string "id", and replace "clickEvent" in its menu items as described in ${HIGHLIGHT_DOCS}.`
        );
      }
      return;
    }
    if (!referencesHighlight && !content.includes('clickEvent')) {
      return;
    }

    const result = migrateFile(filePath, content, referencesHighlight);
    if (result.rewrites > 0) {
      tree.write(filePath, result.content);
      rewritten.push(
        `Added an "id" to ${result.rewrites} HIGHLIGHT payload(s) in ${filePath}. Each id ends in a module-level counter, so every emit still adds its own highlight.`
      );
    }
    pending.push(...result.notes);
  });

  if (rewritten.length > 0) {
    await formatFiles(tree);
  }
  if (pending.length === 0) {
    return { skipAgentic: true };
  }

  return { nextSteps: pending, agentContext: [...rewritten, ...pending] };
}

function migrateFile(
  filePath: string,
  content: string,
  referencesHighlight: boolean
): FileResult {
  ts ??= ensurePackage<typeof import('typescript')>('typescript', '*');
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true
  );
  if (
    (sourceFile as { parseDiagnostics?: unknown[] }).parseDiagnostics?.length
  ) {
    return {
      content,
      rewrites: 0,
      notes: referencesHighlight
        ? [
            `Could not parse ${filePath}, so its HIGHLIGHT payloads and menu items were not checked. Give each HIGHLIGHT payload a unique string "id", and replace "clickEvent" in its menu items as described in ${HIGHLIGHT_DOCS}.`,
          ]
        : [],
    };
  }

  const imports = readHighlightImports(sourceFile);
  const identifiers = new Set<string>();
  const emitters = new Set<string>();
  const eventCalls: CallExpression[] = [];
  const clickEventLines: number[] = [];
  const notes: string[] = [];
  const lineOf = (node: Node) =>
    sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line +
    1;

  const visit = (node: Node): void => {
    if (ts.isIdentifier(node)) {
      identifiers.add(node.text);
    }

    if (
      ts.isCallExpression(node) &&
      node.arguments.length > 0 &&
      isHighlightEvent(node.arguments[0], imports)
    ) {
      eventCalls.push(node);
    } else if (
      isHighlightEvent(node, imports) &&
      !isEventArgument(node) &&
      // `useChannel({ [HIGHLIGHT]: ... })` listens to the event.
      !ts.isComputedPropertyName(node.parent)
    ) {
      notes.push(
        `${filePath}:${lineOf(node)} uses HIGHLIGHT outside an emit call, so the payloads emitted through it were not checked. Give each one a unique string "id".`
      );
    } else if (
      ts.isStringLiteral(node) &&
      node.text === HIGHLIGHT_MODULE &&
      !ts.isImportDeclaration(node.parent) &&
      !ts.isModuleDeclaration(node.parent)
    ) {
      notes.push(
        `${filePath}:${lineOf(node)} loads "${HIGHLIGHT_MODULE}" in a way this migration doesn't read, such as a require, a dynamic import or a re-export. Give each HIGHLIGHT payload emitted through it a unique string "id".`
      );
    } else if (
      ts.isObjectLiteralExpression(node) &&
      hasStaticKey(node, 'clickEvent') &&
      // Outside Highlight files, only the menu item shape counts.
      (referencesHighlight || hasStaticKey(node, 'title'))
    ) {
      clickEventLines.push(lineOf(node));
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

  const payloads: Expression[] = [];
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
    payloads.push(payload);
  }

  if (clickEventLines.length > 0) {
    notes.push(
      `${filePath} has Highlight menu items that use "clickEvent" (line${clickEventLines.length > 1 ? 's' : ''} ${clickEventLines.join(', ')}), which Storybook no longer emits. Set "clickable: true" on them, give their HIGHLIGHT payload a fixed "id", and move the "clickEvent" listener to HIGHLIGHT_MENU_CLICK, which passes the highlight id, the menu item id and the click details. See ${HIGHLIGHT_DOCS}.`
    );
  }
  if (imports.types.has('HighlightOptions')) {
    notes.push(
      `${filePath} uses the HighlightOptions type, which now requires "id". Give each object of that type a unique string "id", or type it as Omit<HighlightOptions, 'id'> when this migration added the "id" where the object is emitted.`
    );
  }
  if (imports.types.has('ClickEventDetails')) {
    notes.push(
      `${filePath} uses the ClickEventDetails type, whose "element" no longer has "outerHTML" or "attributes". Read "tagName", "localName" or the matching "selectors" instead.`
    );
  }

  const counter = uniqueName('highlightCount', identifiers);
  const id = `\`${escapeTemplateText(filePath)}:\${++${counter}}\``;
  const changes: StringChange[] = [];
  let rewrites = 0;
  for (const payload of payloads) {
    const literal = unwrapObjectLiteral(payload);
    if (!literal) {
      // The generated id comes first, so an id the payload carries at runtime
      // still wins.
      changes.push(
        {
          type: ChangeType.Insert,
          index: payload.getStart(sourceFile),
          text: `{ id: ${id}, ...`,
        },
        { type: ChangeType.Insert, index: payload.getEnd(), text: ' }' }
      );
      rewrites++;
    } else if (
      !hasStaticKey(literal, 'id') &&
      // Storybook still gives a legacy `elements` payload an id itself.
      !hasStaticKey(literal, 'elements')
    ) {
      changes.push(insertIdProperty(content, literal, id, sourceFile));
      rewrites++;
    }
  }
  if (rewrites === 0) {
    return { content, rewrites, notes };
  }
  changes.push(declareCounter(sourceFile, counter));

  return {
    content: applyChangesToString(content, changes),
    rewrites,
    notes,
  };
}

function readHighlightImports(sourceFile: SourceFile): HighlightImports {
  const imports: HighlightImports = {
    events: new Set(),
    namespaces: new Set(),
    types: new Set(),
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
      continue;
    }
    for (const element of bindings.elements) {
      const imported = (element.propertyName ?? element.name).text;
      if (imported === 'HIGHLIGHT') {
        imports.events.add(element.name.text);
      } else if (CHANGED_TYPES.has(imported)) {
        imports.types.add(imported);
      }
    }
  }
  return imports;
}

function isHighlightEvent(node: Node, imports: HighlightImports): boolean {
  if (ts.isIdentifier(node)) {
    return imports.events.has(node.text) && !isNamePosition(node);
  }
  if (ts.isStringLiteralLike(node)) {
    return node.text === HIGHLIGHT_EVENT;
  }
  if (
    ts.isPropertyAccessExpression(node) ||
    ts.isElementAccessExpression(node)
  ) {
    return (
      ts.isIdentifier(node.expression) &&
      imports.namespaces.has(node.expression.text) &&
      getStaticName(node) === 'HIGHLIGHT'
    );
  }
  return false;
}

function isNamePosition(node: Identifier): boolean {
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

function hasStaticKey(literal: ObjectLiteralExpression, key: string): boolean {
  return literal.properties.some(
    (property) =>
      property.name !== undefined && getStaticName(property.name) === key
  );
}

function unwrapObjectLiteral(
  expression: Expression
): ObjectLiteralExpression | undefined {
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
  return ts.isObjectLiteralExpression(current) ? current : undefined;
}

function insertIdProperty(
  content: string,
  literal: ObjectLiteralExpression,
  id: string,
  sourceFile: SourceFile
): StringChange {
  const index = literal.getStart(sourceFile) + 1;
  LEADING_NEWLINE.lastIndex = index;
  const newline = LEADING_NEWLINE.exec(content)?.[1];
  const text = newline
    ? `${newline}id: ${id},`
    : ` id: ${id},${/\s/.test(content[index]) ? '' : ' '}`;
  return { type: ChangeType.Insert, index, text };
}

function declareCounter(sourceFile: SourceFile, counter: string): StringChange {
  // Before the first statement that isn't an import or directive, so no code
  // runs before the counter is declared.
  let anchor: Node | undefined;
  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) &&
      !ts.isImportEqualsDeclaration(statement) &&
      !(
        ts.isExpressionStatement(statement) &&
        ts.isStringLiteral(statement.expression)
      )
    ) {
      break;
    }
    anchor = statement;
  }
  const declaration = `let ${counter} = 0;`;
  return anchor
    ? {
        type: ChangeType.Insert,
        index: anchor.getEnd(),
        text: `\n\n${declaration}`,
      }
    : { type: ChangeType.Insert, index: 0, text: `${declaration}\n\n` };
}

function uniqueName(base: string, taken: Set<string>): string {
  let name = base;
  for (let suffix = 2; taken.has(name); suffix++) {
    name = `${base}${suffix}`;
  }
  return name;
}

function escapeTemplateText(text: string): string {
  return text.replace(/[`\\]|\$\{/g, (match) => `\\${match}`);
}
