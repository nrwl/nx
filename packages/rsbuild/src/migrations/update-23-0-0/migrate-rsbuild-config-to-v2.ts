import { type Tree, formatFiles, visitNotIgnoredFiles } from '@nx/devkit';
import { ensureTypescript, ast, type TypescriptAst } from '@nx/devkit/internal';
import type * as ts from 'typescript';

let tsModule: TypescriptAst;

/**
 * Rewrite user-authored `rsbuild.config.{js,ts,mjs,cjs}` files for
 * @rsbuild/core@2 compatibility. Five transformations:
 *
 * 1. `preview.setupMiddlewares` → `server.setupMiddlewares`. v2 moved
 *    middleware setup off the preview-only namespace.
 *
 * 2. `performance.removeMomentLocale: true|false` is dropped — v2
 *    removed the option entirely. moment locale stripping in v2 is
 *    handled via standard externals/aliases.
 *
 * 3. `source.alias` / `source.aliasStrategy` → `resolve.alias` /
 *    `resolve.aliasStrategy`. v2 removed the deprecated `source`-level
 *    options in favor of the `resolve` block.
 *
 * 4. `server.proxy` entry `context` → `pathFilter`. v2's
 *    http-proxy-middleware@4 renamed the matcher option.
 *
 * 5. `server.proxy` entry `on{Open,Close,Error,ProxyReq,ProxyRes}`
 *    handlers → a unified `on: { open, close, error, proxyReq,
 *    proxyRes }` object.
 *
 * Other v2 changes (default `host` flip from 0.0.0.0 to localhost,
 * default `loadConfig: 'auto'`, Node target ESM default) are behavior
 * changes that don't have a deterministic config-rewrite recipe — they
 * live in the docs / release notes instead.
 *
 * All transforms are AST-based: walk the TypeScript parse tree and
 * patch source ranges so quoted keys, spreads, and surrounding comments
 * are preserved.
 */
export default async function migrateRsbuildConfigToV2(tree: Tree) {
  const configFiles: string[] = [];
  visitNotIgnoredFiles(tree, '.', (filePath) => {
    if (
      filePath.endsWith('rsbuild.config.ts') ||
      filePath.endsWith('rsbuild.config.js') ||
      filePath.endsWith('rsbuild.config.mjs') ||
      filePath.endsWith('rsbuild.config.cjs')
    ) {
      configFiles.push(filePath);
    }
  });

  for (const configFile of configFiles) {
    const original = tree.read(configFile, 'utf-8');
    if (!original) continue;
    let next = renameSetupMiddlewares(original);
    next = dropRemoveMomentLocale(next);
    next = moveSourceAliasToResolve(next);
    next = renameProxyContext(next);
    next = groupProxyEventHandlers(next);
    if (next !== original) {
      tree.write(configFile, next);
    }
  }

  await formatFiles(tree);
}

interface SourceEdit {
  start: number;
  end: number;
  replacement: string;
}

function applyEdits(source: string, edits: SourceEdit[]): string {
  if (edits.length === 0) return source;
  const sorted = [...edits].sort((a, b) => b.start - a.start);
  return sorted.reduce(
    (acc, e) => acc.slice(0, e.start) + e.replacement + acc.slice(e.end),
    source
  );
}

function getPropertyName(prop: ts.PropertyAssignment): string | undefined {
  tsModule ??= ensureTypescript();
  const name = prop.name;
  if (tsModule.isIdentifier(name)) return name.text;
  if (
    tsModule.isStringLiteral(name) ||
    tsModule.isNoSubstitutionTemplateLiteral(name)
  ) {
    return name.text;
  }
  return undefined;
}

/**
 * Exported for unit testing. Rewrites a single-key
 * `preview: { setupMiddlewares: [...] }` literal to
 * `server: { setupMiddlewares: [...] }`.
 *
 * Narrowed to the single-key shape only. For any other shape — preview
 * with host/port/headers, multiple keys, or anything beyond the
 * setupMiddlewares array — the file is left untouched. A blanket
 * rename would move options that still belong under `preview` in v2,
 * or duplicate a `server:` key the user already has elsewhere.
 */
export function renameSetupMiddlewares(source: string): string {
  tsModule ??= ensureTypescript();
  if (!source.includes('setupMiddlewares')) return source;

  const sourceFile = ast(source);
  const edits: SourceEdit[] = [];

  const visit = (node: ts.Node) => {
    if (
      tsModule.isPropertyAssignment(node) &&
      getPropertyName(node) === 'preview' &&
      tsModule.isObjectLiteralExpression(node.initializer)
    ) {
      const props = node.initializer.properties;
      if (
        props.length === 1 &&
        tsModule.isPropertyAssignment(props[0]) &&
        getPropertyName(props[0]) === 'setupMiddlewares'
      ) {
        // Replace only the property name `preview` → `server`. The
        // initializer (the object literal with setupMiddlewares) stays
        // untouched, preserving its formatting verbatim.
        const nameNode = node.name;
        edits.push({
          start: nameNode.getStart(sourceFile),
          end: nameNode.getEnd(),
          replacement: 'server',
        });
      }
    }
    tsModule.forEachChild(node, visit);
  };
  visit(sourceFile);

  return applyEdits(source, edits);
}

/**
 * Exported for unit testing. Drops `removeMomentLocale: true|false`
 * property assignments anywhere in the config — v2 removed the option,
 * so the value is irrelevant.
 */
export function dropRemoveMomentLocale(source: string): string {
  tsModule ??= ensureTypescript();
  if (!source.includes('removeMomentLocale')) return source;

  const sourceFile = ast(source);
  const edits: SourceEdit[] = [];

  const visit = (node: ts.Node) => {
    if (
      tsModule.isPropertyAssignment(node) &&
      getPropertyName(node) === 'removeMomentLocale' &&
      (node.initializer.kind === tsModule.SyntaxKind.TrueKeyword ||
        node.initializer.kind === tsModule.SyntaxKind.FalseKeyword)
    ) {
      let endOfRemoval = node.getEnd();
      const trailingText = source.slice(endOfRemoval);
      const trailingMatch = trailingText.match(/^\s*,?\s*\r?\n/);
      if (trailingMatch) {
        endOfRemoval += trailingMatch[0].length;
      }
      let startOfRemoval = node.getStart(sourceFile);
      const lineStart = source.lastIndexOf('\n', startOfRemoval - 1) + 1;
      if (source.slice(lineStart, startOfRemoval).trim() === '') {
        startOfRemoval = lineStart;
      }
      edits.push({
        start: startOfRemoval,
        end: endOfRemoval,
        replacement: '',
      });
    }
    tsModule.forEachChild(node, visit);
  };
  visit(sourceFile);

  return applyEdits(source, edits);
}

/**
 * Exported for unit testing. Relocates `source.alias` and
 * `source.aliasStrategy` into a sibling `resolve` block — v2 removed
 * the deprecated `source`-level forms.
 *
 * Three shapes are handled per config object:
 *  - `source` has only the alias keys, no `resolve` → rename the
 *    `source` key to `resolve` (one-token edit).
 *  - `source` has alias keys plus others, with an existing `resolve`
 *    block → splice the alias properties into the `resolve` block.
 *  - same, but no `resolve` block → create one immediately before
 *    `source` carrying the alias properties.
 *
 * `formatFiles` tidies whitespace afterward, so the inserts only need
 * to be syntactically valid, not pretty.
 */
export function moveSourceAliasToResolve(source: string): string {
  tsModule ??= ensureTypescript();
  if (!/\balias(?:Strategy)?\b/.test(source)) return source;

  const sourceFile = ast(source);
  const edits: SourceEdit[] = [];
  const ALIAS_KEYS = new Set(['alias', 'aliasStrategy']);

  const visit = (node: ts.Node) => {
    if (tsModule.isObjectLiteralExpression(node)) {
      const sourceProp = node.properties.find(
        (p): p is ts.PropertyAssignment =>
          tsModule.isPropertyAssignment(p) && getPropertyName(p) === 'source'
      );
      if (
        sourceProp &&
        tsModule.isObjectLiteralExpression(sourceProp.initializer)
      ) {
        const sourceObj = sourceProp.initializer;
        const aliasProps = sourceObj.properties.filter(
          (p): p is ts.PropertyAssignment =>
            tsModule.isPropertyAssignment(p) &&
            ALIAS_KEYS.has(getPropertyName(p) ?? '')
        );
        if (aliasProps.length > 0) {
          const resolveProp = node.properties.find(
            (p): p is ts.PropertyAssignment =>
              tsModule.isPropertyAssignment(p) &&
              getPropertyName(p) === 'resolve'
          );
          const aliasAreAllProps =
            aliasProps.length === sourceObj.properties.length;

          if (!resolveProp && aliasAreAllProps) {
            // `source` carries nothing but the alias keys — just rename
            // the property to `resolve`.
            edits.push({
              start: sourceProp.name.getStart(sourceFile),
              end: sourceProp.name.getEnd(),
              replacement: 'resolve',
            });
          } else {
            const movedTexts = aliasProps.map((p) => p.getText(sourceFile));
            // Remove each alias property from `source` (+ trailing
            // comma / line terminator).
            for (const p of aliasProps) {
              let end = p.getEnd();
              const trailing = source.slice(end).match(/^\s*,?\s*\r?\n?/);
              if (trailing) end += trailing[0].length;
              let start = p.getStart(sourceFile);
              const lineStart = source.lastIndexOf('\n', start - 1) + 1;
              if (source.slice(lineStart, start).trim() === '') {
                start = lineStart;
              }
              edits.push({ start, end, replacement: '' });
            }
            if (
              resolveProp &&
              tsModule.isObjectLiteralExpression(resolveProp.initializer)
            ) {
              // Splice into the existing `resolve` block, just before
              // its closing brace. Lead with a comma when the block
              // already has properties so we don't fuse onto a
              // comma-less last property.
              const closeBrace = resolveProp.initializer.getEnd() - 1;
              const leadingSep =
                resolveProp.initializer.properties.length > 0 ? ',\n' : '';
              edits.push({
                start: closeBrace,
                end: closeBrace,
                replacement:
                  leadingSep + movedTexts.map((t) => `${t},\n`).join(''),
              });
            } else {
              // No `resolve` block — create one right before `source`.
              const insertAt = sourceProp.getStart(sourceFile);
              edits.push({
                start: insertAt,
                end: insertAt,
                replacement: `resolve: {\n${movedTexts
                  .map((t) => `${t},\n`)
                  .join('')}},\n`,
              });
            }
          }
        }
      }
    }
    tsModule.forEachChild(node, visit);
  };
  visit(sourceFile);

  return applyEdits(source, edits);
}

/**
 * Returns true when `obj` is a `server.proxy` entry — either an element
 * of the array form (`proxy: [{ ... }]`) or a value of the object-map
 * form (`proxy: { '/api': { ... } }`).
 */
function isProxyEntryObject(obj: ts.ObjectLiteralExpression): boolean {
  tsModule ??= ensureTypescript();
  const parent = obj.parent;
  // Array form: proxy: [ { ... } ]
  if (parent && tsModule.isArrayLiteralExpression(parent)) {
    const arrProp = parent.parent;
    return (
      !!arrProp &&
      tsModule.isPropertyAssignment(arrProp) &&
      getPropertyName(arrProp) === 'proxy'
    );
  }
  // Object-map form: proxy: { '/api': { ... } }
  if (parent && tsModule.isPropertyAssignment(parent)) {
    const mapObj = parent.parent;
    if (mapObj && tsModule.isObjectLiteralExpression(mapObj)) {
      const mapProp = mapObj.parent;
      return (
        !!mapProp &&
        tsModule.isPropertyAssignment(mapProp) &&
        getPropertyName(mapProp) === 'proxy'
      );
    }
  }
  return false;
}

/**
 * Exported for unit testing. Renames the `context` matcher option to
 * `pathFilter` inside `server.proxy` entries — http-proxy-middleware@4
 * (pulled in by @rsbuild/core@2) renamed it. Anchored to a proxy entry
 * so an unrelated `context` key elsewhere is left alone.
 */
export function renameProxyContext(source: string): string {
  tsModule ??= ensureTypescript();
  if (!source.includes('context')) return source;

  const sourceFile = ast(source);
  const edits: SourceEdit[] = [];

  const visit = (node: ts.Node) => {
    if (
      tsModule.isPropertyAssignment(node) &&
      getPropertyName(node) === 'context' &&
      tsModule.isObjectLiteralExpression(node.parent) &&
      isProxyEntryObject(node.parent)
    ) {
      edits.push({
        start: node.name.getStart(sourceFile),
        end: node.name.getEnd(),
        replacement: 'pathFilter',
      });
    }
    tsModule.forEachChild(node, visit);
  };
  visit(sourceFile);

  return applyEdits(source, edits);
}

const PROXY_HANDLER_RENAMES: Record<string, string> = {
  onOpen: 'open',
  onClose: 'close',
  onError: 'error',
  onProxyReq: 'proxyReq',
  onProxyRes: 'proxyRes',
};

/**
 * Exported for unit testing. Consolidates the per-event proxy handlers
 * (`onOpen`, `onClose`, `onError`, `onProxyReq`, `onProxyRes`) into a
 * single `on: { open, close, error, proxyReq, proxyRes }` object —
 * http-proxy-middleware@4's unified event API.
 *
 * Skips any proxy entry that already has an `on` property (already
 * migrated). Anchored to proxy entries so unrelated `on*` keys are
 * untouched.
 */
export function groupProxyEventHandlers(source: string): string {
  tsModule ??= ensureTypescript();
  if (!/\bon(Open|Close|Error|ProxyReq|ProxyRes)\b/.test(source)) {
    return source;
  }

  const sourceFile = ast(source);
  const edits: SourceEdit[] = [];

  const visit = (node: ts.Node) => {
    if (tsModule.isObjectLiteralExpression(node) && isProxyEntryObject(node)) {
      const alreadyHasOn = node.properties.some(
        (p) => tsModule.isPropertyAssignment(p) && getPropertyName(p) === 'on'
      );
      if (!alreadyHasOn) {
        const handlers = node.properties.filter(
          (p): p is ts.PropertyAssignment =>
            tsModule.isPropertyAssignment(p) &&
            (getPropertyName(p) ?? '') in PROXY_HANDLER_RENAMES
        );
        if (handlers.length > 0) {
          const entries = handlers.map((p) => {
            const newName = PROXY_HANDLER_RENAMES[getPropertyName(p) as string];
            return `${newName}: ${p.initializer.getText(sourceFile)}`;
          });
          // Replace the first handler's range with the `on` block...
          const first = handlers[0];
          let firstEnd = first.getEnd();
          const firstTrailing = source.slice(firstEnd).match(/^\s*,?\s*\r?\n?/);
          if (firstTrailing) firstEnd += firstTrailing[0].length;
          edits.push({
            start: first.getStart(sourceFile),
            end: firstEnd,
            replacement: `on: {\n${entries.map((e) => `${e},\n`).join('')}},\n`,
          });
          // ...and delete the remaining handlers.
          for (const p of handlers.slice(1)) {
            let end = p.getEnd();
            const trailing = source.slice(end).match(/^\s*,?\s*\r?\n?/);
            if (trailing) end += trailing[0].length;
            let start = p.getStart(sourceFile);
            const lineStart = source.lastIndexOf('\n', start - 1) + 1;
            if (source.slice(lineStart, start).trim() === '') {
              start = lineStart;
            }
            edits.push({ start, end, replacement: '' });
          }
        }
      }
    }
    tsModule.forEachChild(node, visit);
  };
  visit(sourceFile);

  return applyEdits(source, edits);
}
