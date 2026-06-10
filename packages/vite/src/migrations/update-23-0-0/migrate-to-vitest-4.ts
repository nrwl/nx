import { formatFiles, type Tree, visitNotIgnoredFiles } from '@nx/devkit';
import { ensureTypescript } from '@nx/js/internal';
import { ast, query } from '@phenomnomnominal/tsquery';
import picomatch = require('picomatch');
import type {
  ArrayLiteralExpression,
  Identifier,
  ImportDeclaration,
  Node,
  PropertyAssignment,
  SourceFile,
  StringLiteral,
} from 'typescript';
import {
  applyTextEdits,
  removeNodeWithTrailingCommaEdit,
  replaceNodeTextEdit,
  replaceStringLiteralValueEdit,
  type TextEdit,
} from './lib/ast-edits';
import { visitCiFiles } from './lib/ci-files';
import { generateLocalVitestConfigs } from './lib/generate-local-vitest-configs';
import { inlineVitestWorkspaceFiles } from './lib/inline-vitest-workspace';
import {
  isJsOrTsFile,
  visitVitestConfigFiles,
} from './lib/vitest-config-files';

let ts: typeof import('typescript');

/**
 * Hybrid migration paired with `ai-instructions-for-vitest-4.md`. Applies the
 * deterministic, AST-tractable Vitest 3.x → 4.0 changes mechanically and
 * forwards an `agentContext` describing any shape it could not handle so the
 * paired prompt's agent can finish the rest.
 *
 * The "apply" set is intentionally narrow (renames, deletions of dead options,
 * single-property string rewrites). Anything requiring cross-cutting surgery
 * (e.g. pool option flattening, `deps.* → server.deps.*` merge, browser
 * provider function-form rewrite, workspace file inlining) is detected and
 * logged for the agent.
 */
export default async function migrateToVitest4(tree: Tree) {
  ts ??= ensureTypescript();

  const unhandled: string[] = [];

  visitVitestConfigFiles(tree, (filePath) =>
    processVitestConfig(tree, filePath, unhandled)
  );

  // Workspace files are removed entirely in v4. Static ones are inlined into
  // the root config here; dynamic shapes are forwarded to the agent.
  const { foundWorkspaceFiles } = inlineVitestWorkspaceFiles(tree, unhandled);

  // The new root projects config breaks `vitest` runs from package
  // directories that have no config of their own; give those packages one.
  const generatedConfigs = foundWorkspaceFiles
    ? generateLocalVitestConfigs(tree)
    : [];

  visitNotIgnoredFiles(tree, '', (filePath) => {
    if (!isJsOrTsFile(filePath)) return;
    processImportsAndCustomCode(tree, filePath, unhandled);
  });

  visitNotIgnoredFiles(tree, '', (filePath) => {
    if (filePath.endsWith('package.json')) {
      processPackageJson(tree, filePath, unhandled);
    } else if (filePath.endsWith('project.json')) {
      processProjectJson(tree, filePath, unhandled);
    } else if (isEnvFile(filePath)) {
      processEnvFile(tree, filePath, unhandled);
    }
  });

  scanCiFiles(tree, unhandled);

  await formatFiles(tree);

  // Always-shown reminder for state we cannot reach from the workspace tree.
  const nextSteps = [
    `If your CI provider stores Vitest env vars in its dashboard (GitHub Actions repo/org secrets, GitLab CI/CD variables, Vercel/Netlify env vars, etc.), rename \`VITEST_MAX_THREADS\` and \`VITEST_MAX_FORKS\` to \`VITEST_MAX_WORKERS\`, and \`VITE_NODE_DEPS_MODULE_DIRECTORIES\` to \`VITEST_MODULE_DIRECTORIES\`. The pre-pass only handles in-repo files.`,
  ];
  if (generatedConfigs.length > 0) {
    nextSteps.push(
      `Generated a minimal vitest config for packages that run vitest via a package.json script but had no local config (${generatedConfigs.join(
        ', '
      )}). Without one, Vitest 4 climbs to the root \`test.projects\` config and fails to start from those directories. Review them and add any test options the packages need. ` +
        `Note that these packages may also be discovered as projects by root-level \`vitest\` runs when the root \`test.projects\` globs match their new config files.`
    );
  }

  const result: { nextSteps?: string[]; agentContext?: string[] } = {
    nextSteps,
  };
  if (unhandled.length > 0) result.agentContext = unhandled;
  return result;
}

const ENV_FILE_MATCHERS = [picomatch('**/.env'), picomatch('**/.env.*')];
function isEnvFile(filePath: string): boolean {
  const base = filePath.split('/').pop() ?? '';
  // Skip `.envrc` (direnv) — different syntax surface.
  if (base === '.envrc') return false;
  return ENV_FILE_MATCHERS.some((m) => m(filePath));
}

const COVERAGE_DEAD_OPTIONS = new Set([
  'all',
  'extensions',
  'ignoreEmptyLines',
  'experimentalAstAwareRemapping',
]);

const POOL_FLATTEN_OPTIONS = new Set(['execArgv', 'isolate']);

const REMOVED_REPORTER_CALLBACKS = new Set([
  'onCollected',
  'onSpecsCollected',
  'onPathsCollected',
  'onTaskUpdate',
  'onFinished',
]);

function processVitestConfig(
  tree: Tree,
  filePath: string,
  unhandled: string[]
): void {
  const contents = tree.read(filePath, 'utf-8');

  // Cheap precheck: skip files that don't mention any v4 target.
  if (!mightContainV4Targets(contents)) return;

  const sourceFile = ast(contents);
  const edits: TextEdit[] = [];

  collectCoverageRemovalEdits(sourceFile, contents, edits);
  collectWorkspaceRenameEdits(sourceFile, edits);
  collectDepsOptimizerWebEdits(sourceFile, edits);
  collectUseAtomicsRemovalEdits(sourceFile, contents, edits);
  collectMinWorkersRemovalEdits(sourceFile, contents, edits);
  collectReporterRenameEdits(sourceFile, contents, edits);

  collectPoolOptionDetectLogs(sourceFile, filePath, unhandled);
  collectDepsServerMoveLogs(sourceFile, filePath, unhandled);
  collectMatchGlobsLogs(sourceFile, filePath, unhandled);
  collectBrowserStringProviderLogs(sourceFile, filePath, unhandled);
  collectTesterScriptsLogs(sourceFile, filePath, unhandled);
  collectCustomReporterCallbackLogs(sourceFile, filePath, unhandled);

  if (edits.length > 0) {
    tree.write(filePath, applyTextEdits(contents, edits));
  }
}

function mightContainV4Targets(contents: string): boolean {
  // Hit-test: keywords we care about. Cheap string scan to avoid parsing
  // every config file in the workspace.
  return /\b(workspace|projects|coverage|useAtomics|minWorkers|reporters|provider|deps|poolOptions|singleFork|singleThread|maxThreads|maxForks|environmentMatchGlobs|poolMatchGlobs|testerScripts|onCollected|onSpecsCollected|onPathsCollected|onTaskUpdate|onFinished|vmThreads)\b/.test(
    contents
  );
}

/**
 * Coverage option removals (V4-1): `all`, `extensions`, `ignoreEmptyLines`,
 * `experimentalAstAwareRemapping` are all removed in v4. Anchored to
 * `test.coverage`.
 */
function collectCoverageRemovalEdits(
  sourceFile: SourceFile,
  contents: string,
  edits: TextEdit[]
): void {
  for (const optionName of COVERAGE_DEAD_OPTIONS) {
    const identifiers = query<Identifier>(
      sourceFile,
      `PropertyAssignment > Identifier[name=${optionName}]`
    );
    for (const id of identifiers) {
      if (!isInsideTestSubProperty(id, 'coverage')) continue;
      const owningProperty = id.parent as PropertyAssignment;
      edits.push(removeNodeWithTrailingCommaEdit(contents, owningProperty));
    }
  }
}

/**
 * `test.workspace` → `test.projects` (V4-2). The external `vitest.workspace.*`
 * file form is handled separately at the top level: static files are inlined,
 * the rest are logged for the agent.
 */
function collectWorkspaceRenameEdits(
  sourceFile: SourceFile,
  edits: TextEdit[]
): void {
  const identifiers = query<Identifier>(
    sourceFile,
    'PropertyAssignment > Identifier[name=workspace]'
  );
  for (const id of identifiers) {
    if (!isImmediateChildOfTest(id)) continue;
    edits.push(replaceNodeTextEdit(id, 'projects'));
  }
}

/**
 * `deps.optimizer.web` → `deps.optimizer.client` (V4-4). Anchored to
 * `test.deps.optimizer` so the `web` rename only applies to that nesting.
 */
function collectDepsOptimizerWebEdits(
  sourceFile: SourceFile,
  edits: TextEdit[]
): void {
  const identifiers = query<Identifier>(
    sourceFile,
    'PropertyAssignment > Identifier[name=web]'
  );
  for (const id of identifiers) {
    if (!isInsideChain(id, ['test', 'deps', 'optimizer'])) continue;
    edits.push(replaceNodeTextEdit(id, 'client'));
  }
}

/**
 * Remove `poolOptions.threads.useAtomics` (V4-5).
 */
function collectUseAtomicsRemovalEdits(
  sourceFile: SourceFile,
  contents: string,
  edits: TextEdit[]
): void {
  const identifiers = query<Identifier>(
    sourceFile,
    'PropertyAssignment > Identifier[name=useAtomics]'
  );
  for (const id of identifiers) {
    if (!isInsideChain(id, ['test', 'poolOptions', 'threads'])) continue;
    const owningProperty = id.parent as PropertyAssignment;
    edits.push(removeNodeWithTrailingCommaEdit(contents, owningProperty));
  }
}

/**
 * Remove top-level `test.minWorkers` (V4-6). Behaves as `0` in non-watch mode
 * in v4, so dropping the assignment is safe.
 */
function collectMinWorkersRemovalEdits(
  sourceFile: SourceFile,
  contents: string,
  edits: TextEdit[]
): void {
  const identifiers = query<Identifier>(
    sourceFile,
    'PropertyAssignment > Identifier[name=minWorkers]'
  );
  for (const id of identifiers) {
    if (!isImmediateChildOfTest(id)) continue;
    const owningProperty = id.parent as PropertyAssignment;
    edits.push(removeNodeWithTrailingCommaEdit(contents, owningProperty));
  }
}

/**
 * Reporter renames inside `test.reporters` (V4-7).
 *   `'verbose'` → `'tree'`
 *   `'basic'`   → `['default', { summary: false }]`
 */
function collectReporterRenameEdits(
  sourceFile: SourceFile,
  contents: string,
  edits: TextEdit[]
): void {
  const reportersProperties = query<PropertyAssignment>(
    sourceFile,
    'PropertyAssignment:has(Identifier[name=reporters])'
  ).filter(
    (p) =>
      ts.isIdentifier(p.name) &&
      p.name.text === 'reporters' &&
      isImmediateChildOfTest(p.name)
  );

  for (const property of reportersProperties) {
    const init = property.initializer;
    if (!ts.isArrayLiteralExpression(init)) continue;
    for (const element of (init as ArrayLiteralExpression).elements) {
      if (!ts.isStringLiteral(element)) continue;
      if (element.text === 'verbose') {
        edits.push(replaceStringLiteralValueEdit(contents, element, 'tree'));
      } else if (element.text === 'basic') {
        edits.push(
          replaceNodeTextEdit(element, `['default', { summary: false }]`)
        );
      }
    }
  }
}

/**
 * Detect (but do not modify) pool-related options whose v4 semantics require
 * cross-cutting surgery: `singleThread`/`singleFork`, `maxThreads`/`maxForks`,
 * `poolOptions.{forks,threads}.{execArgv,isolate}`,
 * `poolOptions.vmThreads.memoryLimit`.
 */
function collectPoolOptionDetectLogs(
  sourceFile: SourceFile,
  filePath: string,
  unhandled: string[]
): void {
  const singleHits = query<Identifier>(
    sourceFile,
    'PropertyAssignment > Identifier[name=/^single(Thread|Fork)$/]'
  );
  for (const id of singleHits) {
    const literalValue = readBooleanLiteralValue(
      id.parent as PropertyAssignment
    );
    if (literalValue === true) {
      unhandled.push(
        `${filePath}: \`${id.text}: true\` is removed in Vitest 4. ` +
          `Replace it with \`maxWorkers: 1, isolate: false\` at the top of the \`test\` block, then remove \`${id.text}\`.`
      );
    } else if (literalValue === false) {
      unhandled.push(
        `${filePath}: \`${id.text}: false\` is removed in Vitest 4 (it was already the default). ` +
          `Delete the property.`
      );
    } else {
      unhandled.push(
        `${filePath}: \`${id.text}\` is removed in Vitest 4 and the value here is not a boolean literal. ` +
          `If it evaluates to \`true\`, replace with \`maxWorkers: 1, isolate: false\` at the top of \`test\` and remove \`${id.text}\`. ` +
          `If it evaluates to \`false\`, delete it.`
      );
    }
  }

  const maxHits = query<Identifier>(
    sourceFile,
    'PropertyAssignment > Identifier[name=/^max(Threads|Forks)$/]'
  );
  for (const id of maxHits) {
    if (!isImmediateChildOfTest(id)) continue;
    const literalValue = readNumericLiteralValue(
      id.parent as PropertyAssignment
    );
    const currentValueDescr =
      literalValue !== undefined ? ` (current value: ${literalValue})` : '';
    unhandled.push(
      `${filePath}: \`test.${id.text}\`${currentValueDescr} is removed in Vitest 4. ` +
        `Replace with the pool-agnostic \`maxWorkers\` option. ` +
        `If both \`maxThreads\` and \`maxForks\` are set with different values, pick the one matching the pool the project actually uses.`
    );
  }

  for (const optionName of POOL_FLATTEN_OPTIONS) {
    const ids = query<Identifier>(
      sourceFile,
      `PropertyAssignment > Identifier[name=${optionName}]`
    );
    for (const id of ids) {
      const insideForks = isInsideChain(id, ['test', 'poolOptions', 'forks']);
      const insideThreads = isInsideChain(id, [
        'test',
        'poolOptions',
        'threads',
      ]);
      if (!insideForks && !insideThreads) continue;
      const pool = insideForks ? 'forks' : 'threads';
      unhandled.push(
        `${filePath}: \`test.poolOptions.${pool}.${optionName}\` was flattened in Vitest 4. ` +
          `Move it to the top-level \`test.${optionName}\` (one value for all pools).`
      );
    }
  }

  const memoryLimitIds = query<Identifier>(
    sourceFile,
    'PropertyAssignment > Identifier[name=memoryLimit]'
  );
  for (const id of memoryLimitIds) {
    if (!isInsideChain(id, ['test', 'poolOptions', 'vmThreads'])) continue;
    unhandled.push(
      `${filePath}: \`test.poolOptions.vmThreads.memoryLimit\` was renamed and lifted in Vitest 4. ` +
        `Move it to top-level \`test.vmMemoryLimit\`.`
    );
  }
}

function readBooleanLiteralValue(
  property: PropertyAssignment
): boolean | undefined {
  const init = property.initializer;
  if (init.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (init.kind === ts.SyntaxKind.FalseKeyword) return false;
  return undefined;
}

function readNumericLiteralValue(
  property: PropertyAssignment
): number | undefined {
  const init = property.initializer;
  if (ts.isNumericLiteral(init)) return Number(init.text);
  return undefined;
}

/**
 * Detect `test.deps.{external,inline,fallbackCJS}`. Moving them under
 * `test.server.deps` requires conflict-aware merging that we don't attempt
 * mechanically.
 */
function collectDepsServerMoveLogs(
  sourceFile: SourceFile,
  filePath: string,
  unhandled: string[]
): void {
  for (const name of ['external', 'inline', 'fallbackCJS']) {
    const ids = query<Identifier>(
      sourceFile,
      `PropertyAssignment > Identifier[name=${name}]`
    );
    for (const id of ids) {
      if (!isInsideChain(id, ['test', 'deps'])) continue;
      // Don't flag `test.deps.optimizer.<...>` — only direct children of deps.
      if (!isImmediateChildOfProperty(id, 'deps')) continue;
      unhandled.push(
        `${filePath}: \`test.deps.${name}\` moved to \`test.server.deps.${name}\` in Vitest 4. ` +
          `Move the property, merging with any existing \`server.deps\` block.`
      );
    }
  }
}

/**
 * `test.poolMatchGlobs` / `test.environmentMatchGlobs` are removed in v4;
 * their replacement is per-project conditions inside `test.projects`. Always
 * a manual rewrite.
 */
function collectMatchGlobsLogs(
  sourceFile: SourceFile,
  filePath: string,
  unhandled: string[]
): void {
  for (const name of ['poolMatchGlobs', 'environmentMatchGlobs']) {
    const ids = query<Identifier>(
      sourceFile,
      `PropertyAssignment > Identifier[name=${name}]`
    );
    for (const id of ids) {
      if (!isImmediateChildOfTest(id)) continue;
      unhandled.push(
        `${filePath}: \`test.${name}\` is removed in Vitest 4. ` +
          `Express the same per-glob configuration via \`test.projects\` entries with conditions.`
      );
    }
  }
}

/**
 * `browser.provider` as a string is no longer valid in v4 — it must be the
 * return value of a provider function imported from a per-provider package.
 */
function collectBrowserStringProviderLogs(
  sourceFile: SourceFile,
  filePath: string,
  unhandled: string[]
): void {
  const providers = query<StringLiteral>(
    sourceFile,
    'PropertyAssignment:has(Identifier[name=provider]) > StringLiteral'
  );
  for (const lit of providers) {
    if (!isInsideTestSubProperty(lit, 'browser')) continue;
    unhandled.push(
      `${filePath}: \`browser.provider\` is no longer a string in Vitest 4 (current value: ${lit.getText()}). ` +
        `Install the matching \`@vitest/browser-<provider>\` package and use the function form, ` +
        `e.g. \`provider: playwright(...)\`.`
    );
  }
}

/**
 * `browser.testerScripts` (array of scripts) was replaced by
 * `browser.testerHtmlPath` (single HTML file) — a semantic change.
 */
function collectTesterScriptsLogs(
  sourceFile: SourceFile,
  filePath: string,
  unhandled: string[]
): void {
  const ids = query<Identifier>(
    sourceFile,
    'PropertyAssignment > Identifier[name=testerScripts]'
  );
  for (const id of ids) {
    if (!isInsideTestSubProperty(id, 'browser')) continue;
    unhandled.push(
      `${filePath}: \`browser.testerScripts\` was removed in Vitest 4 in favor of \`browser.testerHtmlPath\`. ` +
        `Combine the script contents into a single HTML file and point \`testerHtmlPath\` at it.`
    );
  }
}

/**
 * Custom reporter callbacks removed in v4: `onCollected`, `onSpecsCollected`,
 * `onPathsCollected`, `onTaskUpdate`, `onFinished`. They can appear as
 * `PropertyAssignment` (object literal: `onCollected: () => ...`),
 * `MethodDeclaration` (shorthand: `onCollected() {}`), or class method on a
 * reporter class — the search broadens past `PropertyAssignment` to cover
 * all three.
 */
function collectCustomReporterCallbackLogs(
  sourceFile: SourceFile,
  filePath: string,
  unhandled: string[]
): void {
  for (const name of REMOVED_REPORTER_CALLBACKS) {
    const ids = query<Identifier>(sourceFile, `Identifier[name=${name}]`);
    const matchedAsName = ids.some(isPropertyOrMethodName);
    if (matchedAsName) {
      unhandled.push(
        `${filePath}: custom reporter uses the removed-in-v4 \`${name}\` callback. ` +
          `Migrate to the v4 \`onTestModuleCollected\` / \`onTestCaseResult\` / \`onTestRunEnd\` API.`
      );
    }
  }
}

function isPropertyOrMethodName(id: Node): boolean {
  const parent = id.parent;
  if (!parent) return false;
  if (
    !(
      ts.isPropertyAssignment(parent) ||
      ts.isShorthandPropertyAssignment(parent) ||
      ts.isMethodDeclaration(parent) ||
      ts.isGetAccessorDeclaration(parent) ||
      ts.isSetAccessorDeclaration(parent) ||
      ts.isMethodSignature(parent) ||
      ts.isPropertySignature(parent)
    )
  ) {
    return false;
  }
  // The identifier must be the NAME of the property/method, not an
  // initializer-side reference.
  return (parent as any).name === id;
}

/**
 * Handles import-side concerns:
 *   - `@vitest/browser/context` → `vitest/browser` (V4-3a, mechanical when
 *     the subpath is exactly `/context`).
 *   - `@vitest/browser/utils` (logged — semantic restructure).
 *   - `defineWorkspace` from `vitest/config` (logged — file removed in v4).
 *   - `jest-snapshot` imports inside custom matcher files (logged).
 */
function processImportsAndCustomCode(
  tree: Tree,
  filePath: string,
  unhandled: string[]
): void {
  const contents = tree.read(filePath, 'utf-8');
  const hasBrowserPackage = contents.includes('@vitest/browser');
  const hasDefineWorkspace = contents.includes('defineWorkspace');
  const hasJestSnapshot = contents.includes('jest-snapshot');

  if (!hasBrowserPackage && !hasDefineWorkspace && !hasJestSnapshot) return;

  const sourceFile = ast(contents);
  const importDecls = query<ImportDeclaration>(sourceFile, 'ImportDeclaration');
  const edits: TextEdit[] = [];

  for (const decl of importDecls) {
    if (!ts.isStringLiteral(decl.moduleSpecifier)) continue;
    const spec = decl.moduleSpecifier.text;

    if (spec === '@vitest/browser/context') {
      edits.push(
        replaceStringLiteralValueEdit(
          contents,
          decl.moduleSpecifier,
          'vitest/browser'
        )
      );
    } else if (spec === '@vitest/browser/utils') {
      unhandled.push(
        `${filePath}: imports from '@vitest/browser/utils' moved into 'vitest/browser' under a named \`utils\` export in Vitest 4. ` +
          `Rewrite to \`import { utils } from 'vitest/browser'\` and rebind the used helpers.`
      );
    } else if (spec === '@vitest/browser') {
      unhandled.push(
        `${filePath}: bare \`@vitest/browser\` imports — the package's public surface moved into \`vitest/browser\` (and the per-provider packages) in Vitest 4. ` +
          `Rewrite the import to \`vitest/browser\` and rebind any helpers that moved to the per-provider package.`
      );
    } else if (spec === 'jest-snapshot') {
      unhandled.push(
        `${filePath}: custom matcher imports from 'jest-snapshot'. ` +
          `In Vitest 4, import the snapshot helpers from 'vitest' via the \`Snapshots\` namespace.`
      );
    }

    // `defineWorkspace` is named-imported from vitest/config — flag any usage.
    const named = decl.importClause?.namedBindings;
    if (named && ts.isNamedImports(named)) {
      const usesDefineWorkspace = named.elements.some(
        (el) => el.name.text === 'defineWorkspace'
      );
      if (usesDefineWorkspace) {
        unhandled.push(
          `${filePath}: \`defineWorkspace\` is removed in Vitest 4 (the external \`vitest.workspace.*\` form is gone). ` +
            `Replace with \`defineConfig\` and inline the project list under \`test.projects\` in the root vitest config.`
        );
      }
    }
  }

  if (edits.length > 0) {
    tree.write(filePath, applyTextEdits(contents, edits));
  }
}

const ENV_RENAMES: Array<[RegExp, string]> = [
  [/\bVITEST_MAX_THREADS\b/g, 'VITEST_MAX_WORKERS'],
  [/\bVITEST_MAX_FORKS\b/g, 'VITEST_MAX_WORKERS'],
  [/\bVITE_NODE_DEPS_MODULE_DIRECTORIES\b/g, 'VITEST_MODULE_DIRECTORIES'],
];

function processPackageJson(
  tree: Tree,
  filePath: string,
  unhandled: string[]
): void {
  const contents = tree.read(filePath, 'utf-8');
  let parsed: any;
  try {
    parsed = JSON.parse(contents);
  } catch {
    return;
  }

  let changed = false;

  if (parsed.scripts && typeof parsed.scripts === 'object') {
    for (const [name, value] of Object.entries(parsed.scripts)) {
      if (typeof value !== 'string') continue;
      let updated = value;
      for (const [re, replacement] of ENV_RENAMES) {
        updated = updated.replace(re, replacement);
      }
      if (updated !== value) {
        parsed.scripts[name] = updated;
        changed = true;
      }
    }
  }

  // `@vitest/browser` surface moved into the main `vitest` package and the
  // per-provider packages. Removing the dep without installing the new
  // provider package would break browser runs, so log instead of editing.
  for (const bucket of [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ]) {
    const deps = parsed[bucket];
    if (!deps || typeof deps !== 'object') continue;
    if ('@vitest/browser' in deps) {
      unhandled.push(
        `${filePath}: \`@vitest/browser\` is no longer needed at the top level in Vitest 4 — ` +
          `install the matching per-provider package (\`@vitest/browser-playwright\`, \`@vitest/browser-webdriverio\`, ` +
          `or \`@vitest/browser-preview\`) and remove the \`@vitest/browser\` entry.`
      );
      break; // one note per file is enough
    }
  }

  if (changed) {
    const trailingNewline = contents.endsWith('\n') ? '\n' : '';
    tree.write(filePath, JSON.stringify(parsed, null, 2) + trailingNewline);
  }
}

/**
 * Rewrite `.env` / `.env.*` files: rename the legacy Vitest env vars to the
 * v4-aware names. `VITEST_MAX_THREADS`/`VITEST_MAX_FORKS` only get renamed
 * when exactly one of them is present in the file — both map to the same
 * pool-agnostic `VITEST_MAX_WORKERS`, so a blind rename would produce two
 * conflicting assignments (the latter would silently win per dotenv
 * semantics). When both are present the rename is skipped and the conflict
 * is forwarded to the agent.
 */
function processEnvFile(
  tree: Tree,
  filePath: string,
  unhandled: string[]
): void {
  const contents = tree.read(filePath, 'utf-8');
  if (
    !/(?:VITEST_MAX_THREADS|VITEST_MAX_FORKS|VITE_NODE_DEPS_MODULE_DIRECTORIES)\b/.test(
      contents
    )
  ) {
    return;
  }

  const hasThreads = /^(?:\s*(?:export\s+)?)VITEST_MAX_THREADS\b/m.test(
    contents
  );
  const hasForks = /^(?:\s*(?:export\s+)?)VITEST_MAX_FORKS\b/m.test(contents);

  let updated = contents;
  if (hasThreads && hasForks) {
    unhandled.push(
      `${filePath}: both \`VITEST_MAX_THREADS\` and \`VITEST_MAX_FORKS\` are set — both collapse to the single pool-agnostic \`VITEST_MAX_WORKERS\` in Vitest 4. ` +
        `Decide which value should win based on the pool the project uses (\`test.pool\` in the vitest config) and rename only that line.`
    );
  } else if (hasThreads) {
    updated = updated.replace(
      /^((?:\s*(?:export\s+)?))VITEST_MAX_THREADS\b/gm,
      '$1VITEST_MAX_WORKERS'
    );
  } else if (hasForks) {
    updated = updated.replace(
      /^((?:\s*(?:export\s+)?))VITEST_MAX_FORKS\b/gm,
      '$1VITEST_MAX_WORKERS'
    );
  }

  updated = updated.replace(
    /^((?:\s*(?:export\s+)?))VITE_NODE_DEPS_MODULE_DIRECTORIES\b/gm,
    '$1VITEST_MODULE_DIRECTORIES'
  );

  if (updated !== contents) {
    tree.write(filePath, updated);
  }
}

/**
 * Walk all targets in `project.json` and apply v4 env-var renames inline:
 *   - `options.env` keys
 *   - `options.{args,command,commands}` string content (VAR=value prefixes)
 * Same conflict guard as `.env` files.
 */
function processProjectJson(
  tree: Tree,
  filePath: string,
  unhandled: string[]
): void {
  const contents = tree.read(filePath, 'utf-8');
  let parsed: any;
  try {
    parsed = JSON.parse(contents);
  } catch {
    return;
  }

  const targets = parsed?.targets;
  if (!targets || typeof targets !== 'object') return;

  let changed = false;

  for (const [targetName, target] of Object.entries(targets) as Array<
    [string, any]
  >) {
    const options = target?.options;
    if (!options || typeof options !== 'object') continue;

    // `options.env`: rename keys, with the same threads/forks conflict guard.
    if (options.env && typeof options.env === 'object') {
      const hasThreads = 'VITEST_MAX_THREADS' in options.env;
      const hasForks = 'VITEST_MAX_FORKS' in options.env;
      if (hasThreads && hasForks) {
        unhandled.push(
          `${filePath} (target \`${targetName}\`): both \`VITEST_MAX_THREADS\` and \`VITEST_MAX_FORKS\` are set in \`options.env\` — both collapse to \`VITEST_MAX_WORKERS\` in Vitest 4. ` +
            `Decide which value should win and rename only that key.`
        );
      } else if (hasThreads) {
        options.env = renameObjectKey(
          options.env,
          'VITEST_MAX_THREADS',
          'VITEST_MAX_WORKERS'
        );
        changed = true;
      } else if (hasForks) {
        options.env = renameObjectKey(
          options.env,
          'VITEST_MAX_FORKS',
          'VITEST_MAX_WORKERS'
        );
        changed = true;
      }
      if ('VITE_NODE_DEPS_MODULE_DIRECTORIES' in options.env) {
        options.env = renameObjectKey(
          options.env,
          'VITE_NODE_DEPS_MODULE_DIRECTORIES',
          'VITEST_MODULE_DIRECTORIES'
        );
        changed = true;
      }
    }

    // `options.args` / `options.command` / `options.commands`: in-string renames.
    if (typeof options.args === 'string') {
      const rewritten = rewriteInlineEnvVars(
        options.args,
        filePath,
        targetName,
        unhandled
      );
      if (rewritten !== options.args) {
        options.args = rewritten;
        changed = true;
      }
    } else if (Array.isArray(options.args)) {
      for (let i = 0; i < options.args.length; i++) {
        const entry = options.args[i];
        if (typeof entry !== 'string') continue;
        const rewritten = rewriteInlineEnvVars(
          entry,
          filePath,
          targetName,
          unhandled
        );
        if (rewritten !== entry) {
          options.args[i] = rewritten;
          changed = true;
        }
      }
    }

    if (typeof options.command === 'string') {
      const rewritten = rewriteInlineEnvVars(
        options.command,
        filePath,
        targetName,
        unhandled
      );
      if (rewritten !== options.command) {
        options.command = rewritten;
        changed = true;
      }
    }

    if (Array.isArray(options.commands)) {
      for (let i = 0; i < options.commands.length; i++) {
        const entry = options.commands[i];
        if (typeof entry !== 'string') continue;
        const rewritten = rewriteInlineEnvVars(
          entry,
          filePath,
          targetName,
          unhandled
        );
        if (rewritten !== entry) {
          options.commands[i] = rewritten;
          changed = true;
        }
      }
    }
  }

  if (changed) {
    const trailingNewline = contents.endsWith('\n') ? '\n' : '';
    tree.write(filePath, JSON.stringify(parsed, null, 2) + trailingNewline);
  }
}

function renameObjectKey(
  obj: Record<string, unknown>,
  oldKey: string,
  newKey: string
): Record<string, unknown> {
  const rebuilt: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    rebuilt[k === oldKey ? newKey : k] = v;
  }
  return rebuilt;
}

const VITEST_MAX_THREADS_INLINE = /\bVITEST_MAX_THREADS\b/g;
const VITEST_MAX_FORKS_INLINE = /\bVITEST_MAX_FORKS\b/g;
const VITE_NODE_DEPS_INLINE = /\bVITE_NODE_DEPS_MODULE_DIRECTORIES\b/g;

function rewriteInlineEnvVars(
  value: string,
  filePath: string,
  targetName: string,
  unhandled: string[]
): string {
  const hasThreads = /\bVITEST_MAX_THREADS\b/.test(value);
  const hasForks = /\bVITEST_MAX_FORKS\b/.test(value);
  let updated = value;
  if (hasThreads && hasForks) {
    unhandled.push(
      `${filePath} (target \`${targetName}\`): \`VITEST_MAX_THREADS\` and \`VITEST_MAX_FORKS\` both appear in the same command — both collapse to \`VITEST_MAX_WORKERS\` in Vitest 4. ` +
        `Decide which value should win and rename only that occurrence.`
    );
  } else if (hasThreads) {
    updated = updated.replace(VITEST_MAX_THREADS_INLINE, 'VITEST_MAX_WORKERS');
  } else if (hasForks) {
    updated = updated.replace(VITEST_MAX_FORKS_INLINE, 'VITEST_MAX_WORKERS');
  }
  updated = updated.replace(VITE_NODE_DEPS_INLINE, 'VITEST_MODULE_DIRECTORIES');
  return updated;
}

/**
 * Scan CI provider configs for v4 legacy env-var tokens and forward the file
 * paths to the agent. YAML structure varies by provider; mechanical edits
 * risk breaking comments, anchors, and multi-line strings.
 */
function scanCiFiles(tree: Tree, unhandled: string[]): void {
  visitCiFiles(tree, (filePath, contents) => {
    const tokens: string[] = [];
    if (/\bVITEST_MAX_THREADS\b/.test(contents)) {
      tokens.push('`VITEST_MAX_THREADS`');
    }
    if (/\bVITEST_MAX_FORKS\b/.test(contents)) {
      tokens.push('`VITEST_MAX_FORKS`');
    }
    if (/\bVITE_NODE_DEPS_MODULE_DIRECTORIES\b/.test(contents)) {
      tokens.push('`VITE_NODE_DEPS_MODULE_DIRECTORIES`');
    }
    if (tokens.length === 0) return;
    unhandled.push(
      `${filePath}: found legacy Vitest env-var token(s) in this CI config: ${tokens.join(', ')}. ` +
        `Rename \`VITEST_MAX_THREADS\` / \`VITEST_MAX_FORKS\` → \`VITEST_MAX_WORKERS\` (pick a single value when both are set), and \`VITE_NODE_DEPS_MODULE_DIRECTORIES\` → \`VITEST_MODULE_DIRECTORIES\`.`
    );
  });
}

/**
 * Returns true if `node` lives inside a property whose name is
 * `propertyName`, whose own parent is a property named `test`.
 */
function isInsideTestSubProperty(
  node: Node,
  propertyName: 'coverage' | 'browser' | 'deps'
): boolean {
  const owning = findEnclosingPropertyAssignment(node, propertyName);
  if (!owning) return false;
  return !!findEnclosingPropertyAssignment(owning, 'test');
}

/**
 * Returns true if `node`'s identifier sits as a direct property of a
 * `test:` block (i.e. `test.{name}`, not `test.something.{name}`).
 */
function isImmediateChildOfTest(node: Node): boolean {
  // The Identifier's parent is a PropertyAssignment; that PA's parent is the
  // ObjectLiteralExpression of `test`; that OLE's parent is the `test:`
  // PropertyAssignment itself.
  const pa = node.parent;
  if (!pa || !ts.isPropertyAssignment(pa)) return false;
  const ole = pa.parent;
  if (!ole || !ts.isObjectLiteralExpression(ole)) return false;
  const testPa = ole.parent;
  if (!testPa || !ts.isPropertyAssignment(testPa)) return false;
  return ts.isIdentifier(testPa.name) && testPa.name.text === 'test';
}

/**
 * Like `isImmediateChildOfTest` but parameterised on the immediate parent's
 * property name.
 */
function isImmediateChildOfProperty(node: Node, propertyName: string): boolean {
  const pa = node.parent;
  if (!pa || !ts.isPropertyAssignment(pa)) return false;
  const ole = pa.parent;
  if (!ole || !ts.isObjectLiteralExpression(ole)) return false;
  const ownerPa = ole.parent;
  if (!ownerPa || !ts.isPropertyAssignment(ownerPa)) return false;
  return ts.isIdentifier(ownerPa.name) && ownerPa.name.text === propertyName;
}

/**
 * Returns true if `node`'s ancestors include a chain of property names —
 * outer-most first. So `['test', 'deps', 'optimizer']` matches a node living
 * inside `test.deps.optimizer.<something>` (any sub-property name, e.g.
 * `web`).
 */
function isInsideChain(node: Node, chain: string[]): boolean {
  // Walk inner → outer through enclosing properties, expecting names to
  // match `chain` from the last (innermost) to the first (outermost).
  let current: Node | undefined = node.parent;
  let chainIndex = chain.length - 1;
  while (current && chainIndex >= 0) {
    if (ts.isPropertyAssignment(current) && ts.isIdentifier(current.name)) {
      if (current.name.text === chain[chainIndex]) {
        chainIndex--;
      }
    }
    current = current.parent;
  }
  return chainIndex < 0;
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
