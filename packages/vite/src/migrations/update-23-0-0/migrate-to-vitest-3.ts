import { formatFiles, type Tree, visitNotIgnoredFiles } from '@nx/devkit';
import { ensureTypescript } from '@nx/js/internal';
import { ast, query } from '@phenomnomnominal/tsquery';
import type {
  Identifier,
  ImportDeclaration,
  Node,
  PropertyAssignment,
  SourceFile,
  StringLiteral,
} from 'typescript';
import {
  applyTextEdits,
  replaceNodeTextEdit,
  replaceStringLiteralValueEdit,
  type TextEdit,
} from './lib/ast-edits';
import { visitCiFiles } from './lib/ci-files';
import {
  isJsOrTsFile,
  visitVitestConfigFiles,
} from './lib/vitest-config-files';

let ts: typeof import('typescript');

/**
 * Hybrid migration paired with `ai-instructions-for-vitest-3.md`. Applies the
 * deterministic, AST-tractable Vitest 1.x/2.x → 3.x changes mechanically and
 * returns a `promptContext` describing any shape it could not handle, so the
 * paired prompt's agent can finish those by hand.
 */
export default async function migrateToVitest3(tree: Tree) {
  ts ??= ensureTypescript();

  const unhandled: string[] = [];

  visitVitestConfigFiles(tree, (filePath) =>
    processVitestConfig(tree, filePath, unhandled)
  );

  visitNotIgnoredFiles(tree, '', (filePath) => {
    if (!isJsOrTsFile(filePath)) return;
    processSnapshotEnvironmentImport(tree, filePath, unhandled);
  });

  visitNotIgnoredFiles(tree, '', (filePath) => {
    if (filePath.endsWith('package.json')) {
      processPackageJson(tree, filePath);
    } else if (filePath.endsWith('project.json')) {
      processProjectJson(tree, filePath);
    }
  });

  scanCiFiles(tree, unhandled);

  await formatFiles(tree);

  // Hybrid migration return shape: `promptContext` (when populated) is
  // forwarded to the paired prompt's agent. When no agent runs, the field is
  // dropped silently per the contract — safe on master and pre-agentic flows.
  if (unhandled.length > 0) return { promptContext: unhandled };
  return;
}

function processVitestConfig(
  tree: Tree,
  filePath: string,
  unhandled: string[]
): void {
  const contents = tree.read(filePath, 'utf-8');
  // Cheap prechecks: skip parsing if none of the v3 targets appear.
  const hasC8Provider = /['"]c8['"]/.test(contents);
  const hasNoneProvider = /['"]none['"]/.test(contents);
  const hasIndexScripts = contents.includes('indexScripts');
  if (!hasC8Provider && !hasNoneProvider && !hasIndexScripts) return;

  const sourceFile = ast(contents);
  const edits: TextEdit[] = [];

  const c8EditCountBefore = edits.length;
  if (hasC8Provider) {
    collectCoverageProviderC8Edits(sourceFile, contents, edits);
  }
  if (hasNoneProvider) {
    collectBrowserProviderNoneEdits(sourceFile, contents, edits);
  }
  const indexEditCountBefore = edits.length;
  if (hasIndexScripts) {
    collectIndexScriptsRenameEdits(sourceFile, edits);
  }

  // Fallback signals: precheck hit a vitest-specific token but the AST didn't
  // surface a shape we know how to rewrite (variable indirection, template
  // literal, spread, ternary, etc.). Forward the file path so the agent can
  // investigate.
  if (hasC8Provider && edits.length === c8EditCountBefore) {
    unhandled.push(
      `${filePath}: found a \`'c8'\` string but no direct \`coverage.provider: 'c8'\` assignment to rewrite. ` +
        `If this file's coverage provider resolves to c8 via a variable, ternary, or spread, switch it to \`'v8'\`.`
    );
  }
  if (hasIndexScripts && edits.length === indexEditCountBefore) {
    unhandled.push(
      `${filePath}: found an \`indexScripts\` reference but no direct \`browser.indexScripts\` assignment to rewrite. ` +
        `If this is the legacy browser option, rename it to \`orchestratorScripts\`.`
    );
  }

  if (edits.length === 0) return;
  tree.write(filePath, applyTextEdits(contents, edits));
}

/**
 * `test.coverage.provider: 'c8'` → `'v8'`. Anchored to the `test.coverage`
 * sub-tree so a coincidental `'c8'` elsewhere isn't rewritten.
 */
function collectCoverageProviderC8Edits(
  sourceFile: SourceFile,
  contents: string,
  edits: TextEdit[]
): void {
  const literals = query<StringLiteral>(
    sourceFile,
    'PropertyAssignment:has(Identifier[name=provider]) > StringLiteral[value=c8]'
  );
  for (const lit of literals) {
    if (!isInsideTestSubProperty(lit, 'coverage')) continue;
    edits.push(replaceStringLiteralValueEdit(contents, lit, 'v8'));
  }
}

/**
 * `test.browser.provider: 'none'` → `'preview'`. Anchored similarly to v3-2b.
 */
function collectBrowserProviderNoneEdits(
  sourceFile: SourceFile,
  contents: string,
  edits: TextEdit[]
): void {
  const literals = query<StringLiteral>(
    sourceFile,
    'PropertyAssignment:has(Identifier[name=provider]) > StringLiteral[value=none]'
  );
  for (const lit of literals) {
    if (!isInsideTestSubProperty(lit, 'browser')) continue;
    edits.push(replaceStringLiteralValueEdit(contents, lit, 'preview'));
  }
}

/**
 * `test.browser.indexScripts` → `orchestratorScripts`.
 */
function collectIndexScriptsRenameEdits(
  sourceFile: SourceFile,
  edits: TextEdit[]
): void {
  const identifiers = query<Identifier>(
    sourceFile,
    'PropertyAssignment > Identifier[name=indexScripts]'
  );
  for (const id of identifiers) {
    if (!isInsideTestSubProperty(id, 'browser')) continue;
    edits.push(replaceNodeTextEdit(id, 'orchestratorScripts'));
  }
}

/**
 * `import { SnapshotEnvironment } from 'vitest'` → `from 'vitest/snapshot'`.
 * Only applied when `SnapshotEnvironment` is the SOLE named binding. Mixed
 * imports (e.g. `{ SnapshotEnvironment, vi }`) are logged for the agent —
 * splitting the import is a semantic decision (does the v3.x `SnapshotEnvironment`
 * still live in `vitest`? — no, it moved in v2).
 */
function processSnapshotEnvironmentImport(
  tree: Tree,
  filePath: string,
  unhandled: string[]
): void {
  const contents = tree.read(filePath, 'utf-8');
  if (!contents.includes('SnapshotEnvironment')) return;

  const sourceFile = ast(contents);
  const importDecls = query<ImportDeclaration>(sourceFile, 'ImportDeclaration');
  const edits: TextEdit[] = [];

  for (const decl of importDecls) {
    if (!ts.isStringLiteral(decl.moduleSpecifier)) continue;
    if (decl.moduleSpecifier.text !== 'vitest') continue;

    const named = decl.importClause?.namedBindings;
    if (!named || !ts.isNamedImports(named)) continue;
    const elements = named.elements;
    const hasSnapshotEnv = elements.some(
      (el) => el.name.text === 'SnapshotEnvironment'
    );
    if (!hasSnapshotEnv) continue;

    if (elements.length === 1 && !decl.importClause?.name) {
      // Sole named binding, no default import → flip the module specifier.
      edits.push(
        replaceStringLiteralValueEdit(
          contents,
          decl.moduleSpecifier,
          'vitest/snapshot'
        )
      );
    } else {
      unhandled.push(
        `${filePath}: \`SnapshotEnvironment\` is imported from 'vitest' alongside other bindings. ` +
          `Split it into a separate \`import { SnapshotEnvironment } from 'vitest/snapshot'\` statement.`
      );
    }
  }

  if (edits.length > 0) {
    tree.write(filePath, applyTextEdits(contents, edits));
  }
}

const SEGFAULT_RETRY_RE = /\s*--segfault-retry(?:[= ]\d+)?(?=\s|$)/g;
// `\b` between `k` and `-` is still a word boundary, so the v3.x flag form
// `vitest --typecheck-helper` (hypothetical) would otherwise match. Use a
// lookahead requiring whitespace or end-of-string after the keyword.
const VITEST_TYPECHECK_RE = /\bvitest\s+typecheck(?=\s|$)/g;

function processPackageJson(tree: Tree, filePath: string): void {
  const contents = tree.read(filePath, 'utf-8');
  let parsed: any;
  try {
    parsed = JSON.parse(contents);
  } catch {
    return;
  }

  let changed = false;

  // V3-1: strip `--segfault-retry` from script values.
  // V3-3: `vitest typecheck` → `vitest --typecheck` in script values.
  if (parsed.scripts && typeof parsed.scripts === 'object') {
    for (const [name, value] of Object.entries(parsed.scripts)) {
      if (typeof value !== 'string') continue;
      let updated = value;
      if (updated.includes('--segfault-retry')) {
        updated = updated.replace(SEGFAULT_RETRY_RE, '').trim();
      }
      updated = updated.replace(VITEST_TYPECHECK_RE, 'vitest --typecheck');
      if (updated !== value) {
        parsed.scripts[name] = updated;
        changed = true;
      }
    }
  }

  // V3-2a: `@vitest/coverage-c8` → `@vitest/coverage-v8` in dep buckets,
  // preserving the user's pin verbatim.
  for (const bucket of [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ]) {
    const deps = parsed[bucket];
    if (!deps || typeof deps !== 'object') continue;
    if (!('@vitest/coverage-c8' in deps)) continue;
    if ('@vitest/coverage-v8' in deps) {
      // Both keys present; leave the v8 pin alone and just remove the c8 entry.
      delete deps['@vitest/coverage-c8'];
    } else {
      // Rebuild the bucket to preserve key order with c8 swapped for v8.
      const rebuilt: Record<string, string> = {};
      for (const [k, v] of Object.entries(deps)) {
        if (k === '@vitest/coverage-c8')
          rebuilt['@vitest/coverage-v8'] = v as string;
        else rebuilt[k] = v as string;
      }
      parsed[bucket] = rebuilt;
    }
    changed = true;
  }

  if (changed) {
    const trailingNewline = contents.endsWith('\n') ? '\n' : '';
    tree.write(filePath, JSON.stringify(parsed, null, 2) + trailingNewline);
  }
}

/**
 * Walk all targets in `project.json` and rewrite the same string-level
 * concerns we handle in `package.json` scripts: `--segfault-retry` removal
 * and `vitest typecheck` → `vitest --typecheck`. Applies to `options.args`
 * (string or array), `options.command` (string), and `options.commands`
 * (array of strings).
 */
function processProjectJson(tree: Tree, filePath: string): void {
  const contents = tree.read(filePath, 'utf-8');
  let parsed: any;
  try {
    parsed = JSON.parse(contents);
  } catch {
    return;
  }

  let changed = false;

  const targets = parsed?.targets;
  if (!targets || typeof targets !== 'object') return;

  for (const target of Object.values(targets)) {
    const options = (target as any)?.options;
    if (!options || typeof options !== 'object') continue;

    if (typeof options.args === 'string') {
      const rewritten = rewriteScriptString(options.args);
      if (rewritten !== options.args) {
        options.args = rewritten;
        changed = true;
      }
    } else if (Array.isArray(options.args)) {
      const filtered = options.args.filter(
        (a: unknown) =>
          typeof a !== 'string' || !/^--segfault-retry(?:=\d+)?$/.test(a.trim())
      );
      if (filtered.length !== options.args.length) {
        options.args = filtered;
        changed = true;
      }
    }

    if (typeof options.command === 'string') {
      const rewritten = rewriteScriptString(options.command);
      if (rewritten !== options.command) {
        options.command = rewritten;
        changed = true;
      }
    }

    if (Array.isArray(options.commands)) {
      for (let i = 0; i < options.commands.length; i++) {
        const entry = options.commands[i];
        if (typeof entry === 'string') {
          const rewritten = rewriteScriptString(entry);
          if (rewritten !== entry) {
            options.commands[i] = rewritten;
            changed = true;
          }
        }
      }
    }
  }

  if (changed) {
    const trailingNewline = contents.endsWith('\n') ? '\n' : '';
    tree.write(filePath, JSON.stringify(parsed, null, 2) + trailingNewline);
  }
}

function rewriteScriptString(value: string): string {
  let updated = value;
  if (updated.includes('--segfault-retry')) {
    updated = updated.replace(SEGFAULT_RETRY_RE, '').trim();
  }
  updated = updated.replace(VITEST_TYPECHECK_RE, 'vitest --typecheck');
  return updated;
}

/**
 * Scan CI provider configs for the v3 legacy tokens. YAML edits aren't done
 * mechanically (structure/comment/anchor risk); the file path + tokens are
 * forwarded to the agent.
 */
function scanCiFiles(tree: Tree, unhandled: string[]): void {
  visitCiFiles(tree, (filePath, contents) => {
    const tokens: string[] = [];
    if (contents.includes('--segfault-retry')) {
      tokens.push('`--segfault-retry`');
    }
    if (VITEST_TYPECHECK_RE.test(contents)) {
      tokens.push('`vitest typecheck`');
    }
    // Reset lastIndex because of /g.
    VITEST_TYPECHECK_RE.lastIndex = 0;
    if (tokens.length === 0) return;
    unhandled.push(
      `${filePath}: found legacy token(s) in this CI config: ${tokens.join(', ')}. ` +
        `Remove \`--segfault-retry\` (the option was removed in Vitest 2.0) and rewrite \`vitest typecheck\` as \`vitest --typecheck\` (the subcommand was replaced by the flag).`
    );
  });
}

/**
 * Returns true if `node` lives inside a property named `propertyName` whose
 * own parent is a property named `test` — i.e. anchored to the vitest
 * `test.<propertyName>` sub-tree of the config.
 */
function isInsideTestSubProperty(
  node: Node,
  propertyName: 'coverage' | 'browser'
): boolean {
  const owningProperty = findEnclosingPropertyAssignment(node, propertyName);
  if (!owningProperty) return false;
  return !!findEnclosingPropertyAssignment(owningProperty, 'test');
}

function findEnclosingPropertyAssignment(
  node: Node,
  name: string
): PropertyAssignment | undefined {
  let current: Node | undefined = node.parent;
  while (current) {
    if (
      ts.isPropertyAssignment(current) &&
      ts.isIdentifier(current.name) &&
      current.name.text === name
    ) {
      return current;
    }
    current = current.parent;
  }
  return undefined;
}
