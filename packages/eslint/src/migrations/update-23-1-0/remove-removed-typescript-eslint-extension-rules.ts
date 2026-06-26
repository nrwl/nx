import { formatFiles, type Tree, visitNotIgnoredFiles } from '@nx/devkit';
import * as ts from 'typescript';

// Inlined rather than imported from the @nx/eslint utils so this migration stays
// self-contained - a migration should not depend on a shared list that can change
// in a later version.
const ESLINT_FLAT_CONFIG_FILENAMES = [
  'eslint.config.cjs',
  'eslint.config.js',
  'eslint.config.mjs',
  'eslint.config.cts',
  'eslint.config.ts',
  'eslint.config.mts',
];

// Formatting/extension rules typescript-eslint removed in v8 (moved to
// @stylistic). A flat config that still references one fails to load: "Could not
// find <rule> in plugin @typescript-eslint".
//
// These are DELETED, not rewritten to the base ESLint rule (e.g.
// `@typescript-eslint/no-extra-semi` -> `no-extra-semi`), on purpose: the base
// equivalents are themselves deprecated and frozen in ESLint 9 (slated for
// removal), so resurrecting one just defers the same break to the next ESLint
// major. And Prettier - which nx workspaces run - already enforces this
// formatting, so the rules were redundant. The long-term home is @stylistic,
// which we will not auto-add as a dependency.
const REMOVED_TS_ESLINT_RULES = new Set(
  [
    'block-spacing',
    'brace-style',
    'comma-dangle',
    'comma-spacing',
    'func-call-spacing',
    'indent',
    'key-spacing',
    'keyword-spacing',
    'lines-around-comment',
    'lines-between-class-members',
    'member-delimiter-style',
    'no-extra-parens',
    'no-extra-semi',
    'object-curly-spacing',
    'padding-line-between-statements',
    'quotes',
    'semi',
    'space-before-blocks',
    'space-before-function-paren',
    'space-infix-ops',
    'type-annotation-spacing',
  ].map((rule) => `@typescript-eslint/${rule}`)
);

// Semantic rules typescript-eslint renamed 1:1 in v8. Unlike the formatting
// rules these enforce real behavior, so we rewrite the key to the successor to
// preserve enforcement rather than drop it.
//
// `ban-types` is intentionally NOT here: it split into three rules
// (no-empty-object-type, no-unsafe-function-type, no-wrapper-object-types) whose
// options do not map cleanly, so it is handled by the companion prompt-based
// migration instead.
const RENAMED_TS_ESLINT_RULES = new Map([
  [
    '@typescript-eslint/no-throw-literal',
    '@typescript-eslint/only-throw-error',
  ],
  [
    '@typescript-eslint/no-useless-template-literals',
    '@typescript-eslint/no-unnecessary-template-expression',
  ],
]);

export default async function update(tree: Tree): Promise<void> {
  let changed = false;

  visitNotIgnoredFiles(tree, '.', (path) => {
    const fileName = path.split('/').pop();
    if (!ESLINT_FLAT_CONFIG_FILENAMES.includes(fileName)) {
      return;
    }
    const content = tree.read(path, 'utf-8');
    if (!content?.includes('@typescript-eslint/')) {
      return;
    }

    const source = ts.createSourceFile(
      path,
      content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.JS
    );

    // {start, end, newText} edits, applied high offset -> low so earlier offsets
    // stay valid. Covers both deletes (newText '') and key rewrites uniformly.
    const edits: { start: number; end: number; newText: string }[] = [];
    const visit = (node: ts.Node): void => {
      if (
        ts.isPropertyAssignment(node) &&
        (ts.isStringLiteral(node.name) ||
          ts.isNoSubstitutionTemplateLiteral(node.name))
      ) {
        const ruleName = node.name.text;
        if (REMOVED_TS_ESLINT_RULES.has(ruleName)) {
          // Remove the whole rule entry, including its leading whitespace and the
          // trailing comma, so the surrounding rules object stays valid.
          let end = node.end;
          const trailingComma = content.slice(end).match(/^\s*,/);
          if (trailingComma) {
            end += trailingComma[0].length;
          }
          edits.push({ start: node.getFullStart(), end, newText: '' });
        } else if (RENAMED_TS_ESLINT_RULES.has(ruleName)) {
          // Rewrite only the key, preserving the existing quote style and value.
          const keyStart = node.name.getStart(source);
          const quote = content[keyStart];
          edits.push({
            start: keyStart,
            end: node.name.getEnd(),
            newText: `${quote}${RENAMED_TS_ESLINT_RULES.get(ruleName)}${quote}`,
          });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);

    if (edits.length) {
      edits.sort((a, b) => b.start - a.start);
      let updated = content;
      for (const edit of edits) {
        updated =
          updated.slice(0, edit.start) + edit.newText + updated.slice(edit.end);
      }
      tree.write(path, updated);
      changed = true;
    }
  });

  if (changed) {
    await formatFiles(tree);
  }
}
