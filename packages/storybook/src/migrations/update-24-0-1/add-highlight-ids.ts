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
  Identifier,
  Node,
  ObjectLiteralExpression,
  PropertyName,
  SourceFile,
  TypeChecker,
} from 'typescript';

const HIGHLIGHT_MODULE = 'storybook/highlight';
const PREVIEW_API_MODULE = 'storybook/preview-api';
// The value of the `HIGHLIGHT` constant.
const HIGHLIGHT_EVENT = 'storybook/highlight/add';
const HIGHLIGHT_DOCS =
  'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#highlight-menu-items-emit-a-fixed-highlight_menu_click-event-with-a-mandatory-id';
const SOURCE_FILE_PATTERN = /\.[cm]?[jt]sx?$/;
// Story and docs formats whose scripts can use Highlight but aren't parsed here.
const UNPARSED_FILE_PATTERN = /\.(mdx|svelte|vue)$/;
const LEADING_NEWLINE = /[ \t]*(\r?\n[ \t]*)/y;

type ImportBindings = {
  highlight: Identifier[];
  useChannel: Identifier[];
};

let ts: typeof import('typescript') | undefined;

export default async function addHighlightIds(tree: Tree) {
  let rewritten = false;
  const pending: string[] = [];

  // Stories, decorators, preview files and addons can all use Highlight, so
  // the whole workspace is scanned.
  visitNotIgnoredFiles(tree, '.', (filePath) => {
    const parsable = SOURCE_FILE_PATTERN.test(filePath);
    if (!parsable && !UNPARSED_FILE_PATTERN.test(filePath)) {
      return;
    }
    const content = tree.read(filePath, 'utf-8');
    const usesHighlight = content.includes(HIGHLIGHT_MODULE);
    if (!usesHighlight && !content.includes('clickEvent')) {
      return;
    }

    if (parsable && usesHighlight) {
      const migrated = addIds(filePath, content);
      if (migrated !== content) {
        tree.write(filePath, migrated);
        rewritten = true;
      }
    }
    // Files are listed even after ids were added: other Highlight usage in
    // them can take forms that static analysis can't rule out.
    pending.push(
      usesHighlight
        ? `${filePath} uses "${HIGHLIGHT_MODULE}". Make sure each HIGHLIGHT payload with "selectors" has a unique string "id", that menu items use "clickable" instead of "clickEvent", and that code reading click details doesn't use "outerHTML" or "attributes". See ${HIGHLIGHT_DOCS}.`
        : `${filePath} uses "clickEvent". If it defines Highlight menu items, set "clickable: true" on them and move the "clickEvent" listener to HIGHLIGHT_MENU_CLICK. See ${HIGHLIGHT_DOCS}.`
    );
  });

  if (rewritten) {
    await formatFiles(tree);
  }
  if (pending.length === 0) {
    return { skipAgentic: true };
  }

  return { nextSteps: pending, agentContext: pending };
}

// Adds an id only to an object literal passed straight to an emitter from
// `useChannel`, which Storybook types as `(eventName: string, ...args: any)`.
// Any other payload can have a type that rejects the new property.
function addIds(filePath: string, content: string): string {
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
    return content;
  }
  const imports = readImports(sourceFile);
  if (imports.useChannel.length === 0) {
    return content;
  }

  const checker = createChecker(sourceFile);
  const isHighlightBinding = createImportBindingCheck(
    checker,
    imports.highlight
  );
  const isUseChannelBinding = createImportBindingCheck(
    checker,
    imports.useChannel
  );
  const isHighlightEvent = (node: Node) =>
    ts.isStringLiteralLike(node)
      ? node.text === HIGHLIGHT_EVENT
      : isHighlightBinding(node);
  const isUseChannelEmitter = (callee: Node) => {
    const declaration = checker.getSymbolAtLocation(callee)?.valueDeclaration;
    return (
      declaration !== undefined &&
      ts.isVariableDeclaration(declaration) &&
      !declaration.type &&
      !ts.getJSDocType(declaration) &&
      declaration.initializer !== undefined &&
      ts.isCallExpression(declaration.initializer) &&
      isUseChannelBinding(declaration.initializer.expression)
    );
  };

  // A fixed id would make a repeated emit replace the earlier highlight.
  const id = `\`${escapeTemplateText(filePath)}-\${Math.random().toString(36).slice(2)}\``;
  const changes: StringChange[] = [];
  const visit = (node: Node): void => {
    if (ts.isCallExpression(node)) {
      const payload = getAddablePayload(node);
      if (
        payload &&
        isHighlightEvent(node.arguments[0]) &&
        isUseChannelEmitter(node.expression) &&
        !hasLocalMath(checker, payload)
      ) {
        changes.push(insertIdProperty(payload, id, sourceFile));
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  return applyChangesToString(content, changes);
}

function readImports(sourceFile: SourceFile): ImportBindings {
  const imports: ImportBindings = { highlight: [], useChannel: [] };
  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      continue;
    }
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) {
      continue;
    }
    const moduleName = statement.moduleSpecifier.text;
    for (const element of bindings.elements) {
      const imported = (element.propertyName ?? element.name).text;
      if (moduleName === HIGHLIGHT_MODULE && imported === 'HIGHLIGHT') {
        imports.highlight.push(element.name);
      } else if (
        moduleName === PREVIEW_API_MODULE &&
        imported === 'useChannel'
      ) {
        imports.useChannel.push(element.name);
      }
    }
  }
  return imports;
}

// Returns the payload when it is an object literal with readable keys that
// sets neither `id` nor the legacy `elements`, which Storybook gives an id.
function getAddablePayload(
  call: CallExpression
): ObjectLiteralExpression | undefined {
  const payload = call.arguments[1];
  if (!payload || !ts.isObjectLiteralExpression(payload)) {
    return undefined;
  }
  const addable = payload.properties.every((property) => {
    if (ts.isSpreadAssignment(property)) {
      return false;
    }
    const name = getPropertyName(property.name);
    return name !== undefined && name !== 'id' && name !== 'elements';
  });
  return addable ? payload : undefined;
}

function getPropertyName(name: PropertyName): string | undefined {
  if (!ts.isComputedPropertyName(name)) {
    return name.text;
  }
  return ts.isStringLiteralLike(name.expression)
    ? name.expression.text
    : undefined;
}

// A local declaration can reuse an imported name, so names are compared by the
// symbol the checker binds them to.
function createImportBindingCheck(
  checker: TypeChecker,
  bindings: Identifier[]
): (node: Node) => boolean {
  const importSymbols = new Set(
    bindings.map((binding) => checker.getSymbolAtLocation(binding))
  );
  return (node) => {
    const symbol = checker.getSymbolAtLocation(node);
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
// binding. Imports, type-only ones included, are unresolved aliases.
function hasLocalMath(checker: TypeChecker, node: Node): boolean {
  return checker
    .getSymbolsInScope(node, ts.SymbolFlags.Value | ts.SymbolFlags.Alias)
    .some((symbol) => symbol.name === 'Math');
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
