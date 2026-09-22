import {
  formatFiles,
  readJson,
  updateJson,
  visitNotIgnoredFiles,
  type Tree,
} from '@nx/devkit';
import { ensureTypescript } from '@nx/js/internal';
import { ast, query } from '@phenomnomnominal/tsquery';
import type { SourceFile, StringLiteral } from 'typescript';

/**
 * Hybrid migration paired with `ai-instructions-for-vitest-5.md`. Applies the
 * handful of Vitest 4 -> 5 changes that have one correct answer and forwards
 * everything else to the paired prompt.
 *
 * The apply set is deliberately small: the rest of v5's breaking changes are
 * runtime semantics (mock clearing, unawaited assertions, hoisting) that a
 * test run surfaces far better than a codemod can guess at.
 */
export default async function migrateToVitest5(tree: Tree) {
  // tsquery parses through the workspace's typescript.
  ensureTypescript();

  const unhandled: string[] = [];

  addVitestArtifactsDirToGitIgnore(tree);
  const addedVite = declareVitePeerDependency(tree);

  visitNotIgnoredFiles(tree, '', (filePath) => {
    if (!isJsOrTsFile(filePath)) return;
    rewriteRemovedEntryPoints(tree, filePath, unhandled);
    detectSequentialUsage(tree, filePath, unhandled);
  });

  await formatFiles(tree);

  const result: { nextSteps?: string[]; agentContext?: string[] } = {};
  if (addedVite) {
    result.nextSteps = [
      `Added \`vite\` to the root \`package.json\` devDependencies. Vitest 4 depended on Vite directly; Vitest 5 only declares it as a required peer, so a workspace that relied on the transitive copy has none after the upgrade. It was pinned to the latest major - lower it if a Vite plugin in the workspace needs an older one.`,
    ];
  }
  if (unhandled.length > 0) result.agentContext = unhandled;
  return result;
}

const VITE_VERSION = '^8.0.0';

/**
 * Vitest 4 listed `vite` in `dependencies`, so workspaces that only ran tests
 * never had to declare it. Vitest 5 dropped it to a required peer.
 */
function declareVitePeerDependency(tree: Tree): boolean {
  if (!tree.exists('package.json')) return false;
  const packageJson = readJson(tree, 'package.json');
  const hasVitest =
    packageJson.dependencies?.['vitest'] ??
    packageJson.devDependencies?.['vitest'];
  if (!hasVitest) return false;
  if (
    packageJson.dependencies?.['vite'] ??
    packageJson.devDependencies?.['vite']
  )
    return false;

  updateJson(tree, 'package.json', (json) => {
    json.devDependencies ??= {};
    json.devDependencies['vite'] = VITE_VERSION;
    return json;
  });
  return true;
}

const TS_JS_RE = /\.[cm]?[jt]sx?$/;
function isJsOrTsFile(filePath: string): boolean {
  return TS_JS_RE.test(filePath);
}

/**
 * v5 removed the deprecated deep entry points. Each specifier below has all of
 * its exports in exactly one replacement, so the rewrite is a straight swap.
 * `vitest/environments` is absent on purpose: its exports split across
 * `vitest/runtime` (`builtinEnvironments`, `populateGlobal`) and `vitest/node`
 * (`VitestEnvironment`), so it goes to the agent instead.
 */
const REMOVED_ENTRY_POINTS: Record<string, string> = {
  'vitest/reporters': 'vitest/node',
  'vitest/coverage': 'vitest/node',
  'vitest/runners': 'vitest/runtime',
  'vitest/snapshot': 'vitest/runtime',
  'vitest/suite': 'vitest',
};

/**
 * Only plain import/export declarations are rewritten. A removed specifier
 * reached any other way still has to go, so name it for the agent.
 */
function reportUnrewritableSpecifiers(
  sourceFile: SourceFile,
  rewritable: StringLiteral[],
  filePath: string,
  unhandled: string[]
): void {
  const rewritableStarts = new Set(
    rewritable.map((node) => node.getStart(sourceFile))
  );
  const stragglers = new Set(
    query<StringLiteral>(sourceFile, 'StringLiteral')
      .filter(
        (node) =>
          node.text in REMOVED_ENTRY_POINTS &&
          !rewritableStarts.has(node.getStart(sourceFile))
      )
      .map((node) => node.text)
  );

  for (const specifier of stragglers) {
    unhandled.push(
      `${filePath} references \`${specifier}\` outside a plain import or export declaration (a dynamic \`import()\`, a \`require()\`, or an \`import('...')\` type). Vitest 5 removed it; its exports are now in \`${REMOVED_ENTRY_POINTS[specifier]}\`.`
    );
  }
}

function rewriteRemovedEntryPoints(
  tree: Tree,
  filePath: string,
  unhandled: string[]
): void {
  const contents = tree.read(filePath, 'utf-8');
  if (!contents?.includes('vitest/')) return;

  const sourceFile = ast(contents);
  const specifiers = query<StringLiteral>(
    sourceFile,
    'ImportDeclaration > StringLiteral, ExportDeclaration > StringLiteral'
  );
  reportUnrewritableSpecifiers(sourceFile, specifiers, filePath, unhandled);

  let updated = contents;
  let changed = false;
  // Right-to-left so earlier offsets stay valid as the text shifts.
  for (const specifier of [...specifiers].reverse()) {
    const replacement = REMOVED_ENTRY_POINTS[specifier.text];
    if (!replacement) {
      if (specifier.text === 'vitest/environments') {
        unhandled.push(
          `${filePath} imports from \`vitest/environments\`, which Vitest 5 removed. Its exports moved to two places: \`builtinEnvironments\` and \`populateGlobal\` are now in \`vitest/runtime\`, and the \`VitestEnvironment\` type is in \`vitest/node\`. Split the import according to what the file uses.`
        );
      }
      continue;
    }
    updated =
      updated.slice(0, specifier.getStart(sourceFile) + 1) +
      replacement +
      updated.slice(specifier.getEnd() - 1);
    changed = true;
  }

  if (changed) tree.write(filePath, updated);
}

/**
 * `test.sequential()` / `describe.sequential()` and the `sequential` test
 * option are gone in v5. The replacement depends on whether the test inherits
 * concurrency from a suite or the config, so the agent decides rather than the
 * codemod.
 */
function detectSequentialUsage(
  tree: Tree,
  filePath: string,
  unhandled: string[]
): void {
  const contents = tree.read(filePath, 'utf-8');
  if (!contents?.includes('sequential')) return;

  const sourceFile = ast(contents);
  const usages = query(
    sourceFile,
    'PropertyAccessExpression > Identifier[name=sequential], PropertyAssignment > Identifier[name=sequential]'
  );
  if (usages.length === 0) return;

  unhandled.push(
    `${filePath} uses \`sequential\`, which Vitest 5 removed. Replace \`test.sequential(...)\` / \`describe.sequential(...)\` with a plain \`test(...)\` / \`describe(...)\` when nothing makes them concurrent, and with the \`{ concurrent: false }\` option when they are opting out of a concurrent suite or a concurrent setting in the config.`
  );
}

/**
 * v5 unifies attachments, blob reports, failure screenshots and the json/junit
 * reporter output (which now writes files by default) under `.vitest`.
 */
function addVitestArtifactsDirToGitIgnore(tree: Tree): void {
  if (!tree.exists('.gitignore')) return;
  const contents = tree.read('.gitignore', 'utf-8') ?? '';
  if (/^\.vitest$/m.test(contents)) return;
  tree.write('.gitignore', `${contents.replace(/\s*$/, '')}\n.vitest\n`);
}
