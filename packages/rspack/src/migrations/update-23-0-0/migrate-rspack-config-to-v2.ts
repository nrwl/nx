import { type Tree, formatFiles, visitNotIgnoredFiles } from '@nx/devkit';
import { ast } from '@phenomnomnominal/tsquery';
import * as ts from 'typescript';

/**
 * Rewrite user-authored `rspack.config.{js,ts,mjs,cjs}` files for
 * @rspack/core@2 compatibility (per
 * rspack.rs/guide/migration/rspack_1.x).
 *
 * Two transformations:
 *
 * 1. `output.libraryTarget: '<value>'` → `output.library: { type: '<value>' }`
 *    (Library options were restructured; v2 removed the legacy shortcut.)
 *
 * 2. `experiments.css: true` is dropped (CSS is enabled by default in
 *    v2). `experiments.css: false` is replaced with an explanatory
 *    comment so the user can decide how to opt out — v2 removed the
 *    experiment entirely and there's no direct equivalent.
 *
 * Both transforms are AST-based: they walk the TypeScript parse tree
 * and patch source ranges, so quoted property keys, spreads,
 * conditional initializers, and comments inside the literal are all
 * handled correctly. Configs whose target property is a variable
 * reference (not a literal) are skipped rather than mangled.
 */
export default async function migrateRspackConfigToV2(tree: Tree) {
  const configFiles: string[] = [];
  visitNotIgnoredFiles(tree, '.', (filePath) => {
    if (
      filePath.endsWith('rspack.config.ts') ||
      filePath.endsWith('rspack.config.js') ||
      filePath.endsWith('rspack.config.mjs') ||
      filePath.endsWith('rspack.config.cjs')
    ) {
      configFiles.push(filePath);
    }
  });

  for (const configFile of configFiles) {
    const original = tree.read(configFile, 'utf-8');
    if (!original) continue;
    let next = rewriteLibraryTarget(original);
    next = rewriteExperimentsCss(next);
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
  // Apply back-to-front so earlier edits don't shift later offsets.
  const sorted = [...edits].sort((a, b) => b.start - a.start);
  return sorted.reduce(
    (acc, e) => acc.slice(0, e.start) + e.replacement + acc.slice(e.end),
    source
  );
}

function getPropertyName(prop: ts.PropertyAssignment): string | undefined {
  const name = prop.name;
  if (ts.isIdentifier(name)) return name.text;
  if (ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name)) {
    return name.text;
  }
  return undefined;
}

function isInsideObjectKeyed(
  prop: ts.PropertyAssignment,
  parentKey: string
): boolean {
  const objLiteral = prop.parent;
  if (!objLiteral || !ts.isObjectLiteralExpression(objLiteral)) return false;
  const containingProp = objLiteral.parent;
  if (!containingProp || !ts.isPropertyAssignment(containingProp)) return false;
  return getPropertyName(containingProp) === parentKey;
}

/**
 * Exported for unit testing. Rewrites `output.libraryTarget: 'value'` into
 * `output.library: { type: 'value' }`. AST-anchored to `output:` so an
 * unrelated `libraryTarget` token elsewhere in the config isn't touched.
 * Skips non-literal initializers (variable form, template expressions).
 */
export function rewriteLibraryTarget(source: string): string {
  if (!source.includes('libraryTarget')) return source;

  const sourceFile = ast(source);
  const edits: SourceEdit[] = [];

  const visit = (node: ts.Node) => {
    if (
      ts.isPropertyAssignment(node) &&
      getPropertyName(node) === 'libraryTarget' &&
      isInsideObjectKeyed(node, 'output') &&
      isStringLikeInitializer(node.initializer)
    ) {
      const valueText = node.initializer.getText(sourceFile);
      edits.push({
        start: node.getStart(sourceFile),
        end: node.getEnd(),
        replacement: `library: { type: ${valueText} }`,
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  return applyEdits(source, edits);
}

function isStringLikeInitializer(
  node: ts.Expression
): node is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
}

/**
 * Exported for unit testing. Deletes `experiments.css: false` — v2's
 * "native CSS handling is per-rule, not a global toggle" semantics
 * means the opt-out is a no-op (you already aren't enabling it unless
 * `module.rules` declares a CSS rule).
 *
 * `experiments.css: true` is intentionally left alone here. The
 * promotion to default-on requires injecting a `module.rules` entry
 * with `type: 'css/auto'` (or `css` / `css/module`) — a workspace-
 * specific decision that's handled by the companion AI-prompt
 * migration `rewrite-experiments-css-to-module-rules`.
 *
 * AST-anchored to the `experiments:` parent so unrelated `css` keys
 * elsewhere (loader options, DefinePlugin payloads) are not touched.
 */
export function rewriteExperimentsCss(source: string): string {
  if (!/\bcss\s*:/.test(source)) return source;

  const sourceFile = ast(source);
  const edits: SourceEdit[] = [];

  const visit = (node: ts.Node) => {
    if (
      ts.isPropertyAssignment(node) &&
      getPropertyName(node) === 'css' &&
      isInsideObjectKeyed(node, 'experiments') &&
      node.initializer.kind === ts.SyntaxKind.FalseKeyword
    ) {
      // Delete the property + its trailing comma and newline so the
      // surrounding object literal stays well-formed.
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
      edits.push({ start: startOfRemoval, end: endOfRemoval, replacement: '' });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  return applyEdits(source, edits);
}
