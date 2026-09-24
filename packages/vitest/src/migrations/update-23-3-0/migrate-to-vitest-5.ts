import {
  formatFiles,
  readJson,
  updateJson,
  visitNotIgnoredFiles,
  type Tree,
} from '@nx/devkit';
import { getInstalledPackageVersion } from '@nx/devkit/internal';
import { ensureTypescript } from '@nx/js/internal';
import { major } from 'semver';
import { ast, query } from '@phenomnomnominal/tsquery';
import type {
  ExportSpecifier,
  ImportSpecifier,
  SourceFile,
  StringLiteral,
} from 'typescript';

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
      `Added \`vite\` to the root \`package.json\` devDependencies, matching the version already resolved in the workspace. Vitest 4 depended on Vite directly; Vitest 5 only declares it as a required peer, so a workspace that relied on the transitive copy has none after the upgrade.`,
    ];
  }
  if (unhandled.length > 0) result.agentContext = unhandled;
  return result;
}

// Fallback only. The workspace's own resolved vite is preferred, since moving
// a 6.4 or 7.x workspace to 8 is a bundler major riding inside a test upgrade.
const FALLBACK_VITE_VERSION = '^8.0.0';

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

  const installedVite = getInstalledPackageVersion('vite');
  updateJson(tree, 'package.json', (json) => {
    json.devDependencies ??= {};
    json.devDependencies['vite'] = installedVite
      ? `^${major(installedVite)}.0.0`
      : FALLBACK_VITE_VERSION;
    return json;
  });
  return true;
}

const TS_JS_RE = /\.[cm]?[jt]sx?$/;
function isJsOrTsFile(filePath: string): boolean {
  return TS_JS_RE.test(filePath);
}

/**
 * v5 removed the deprecated deep entry points. A specifier is only rewritten
 * when every one of its v4 exports landed in a single v5 module; the rest are
 * described for the agent, because their exports scattered or disappeared.
 */
const REMOVED_ENTRY_POINTS: Record<
  string,
  { replacement?: string; note: string }
> = {
  'vitest/reporters': {
    replacement: 'vitest/node',
    note: 'its reporter exports are now in `vitest/node`',
  },
  'vitest/coverage': {
    replacement: 'vitest/node',
    note: '`BaseCoverageProvider` is now in `vitest/node`',
  },
  'vitest/snapshot': {
    replacement: 'vitest/runtime',
    note: 'its snapshot exports are now in `vitest/runtime`',
  },
  'vitest/environments': {
    replacement: 'vitest/runtime',
    note: 'its environment exports are now in `vitest/runtime`',
  },
  'vitest/suite': {
    note: 'its exports did not survive as module exports. `getCurrentSuite` and `createTaskCollector` are static members of `TestRunner` (exported from `vitest`), and the rest were removed. Rebind the use sites rather than repointing the import',
  },
  'vitest/runners': {
    note: 'its exports split up. `VitestTestRunner` is exported from `vitest`, `VitestRunner` from `vitest/runtime`, and `NodeBenchmarkRunner` was removed with the old benchmark API',
  },
};

/**
 * Exports the v5 benchmark rewrite removed outright. A file importing one of
 * these from `vitest/reporters` cannot simply be repointed.
 */
const REMOVED_SYMBOLS = new Set([
  'BenchmarkBuiltinReporters',
  'BenchmarkReporter',
  'BenchmarkReportsMap',
  'VerboseBenchmarkReporter',
  'NodeBenchmarkRunner',
]);

/**
 * Only import and export declarations are rewritten. A removed specifier
 * reached any other way still has to go, so name it for the agent.
 */
function reportUnrewritableSpecifiers(
  sourceFile: SourceFile,
  moduleSpecifiers: StringLiteral[],
  filePath: string,
  unhandled: string[]
): void {
  const specifierStarts = new Set(
    moduleSpecifiers.map((node) => node.getStart(sourceFile))
  );
  const stragglers = new Set(
    query<StringLiteral>(sourceFile, 'StringLiteral')
      .filter(
        (node) =>
          node.text in REMOVED_ENTRY_POINTS &&
          !specifierStarts.has(node.getStart(sourceFile))
      )
      .map((node) => node.text)
  );

  for (const specifier of stragglers) {
    unhandled.push(
      `${filePath} references \`${specifier}\` outside an import or export declaration. Vitest 5 removed it: ${REMOVED_ENTRY_POINTS[specifier].note}.`
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
    const entryPoint = REMOVED_ENTRY_POINTS[specifier.text];
    if (!entryPoint) continue;

    const relocated = boundNamesOf(specifier).filter((name) =>
      REMOVED_SYMBOLS.has(name)
    );
    if (!entryPoint.replacement || relocated.length) {
      unhandled.push(
        `${filePath} imports from \`${specifier.text}\`, which Vitest 5 removed: ${
          relocated.length
            ? `\`${relocated.join('`, `')}\` no longer exists anywhere, it went with the old benchmark API`
            : entryPoint.note
        }.`
      );
      continue;
    }

    updated =
      updated.slice(0, specifier.getStart(sourceFile) + 1) +
      entryPoint.replacement +
      updated.slice(specifier.getEnd() - 1);
    changed = true;
  }

  if (changed) tree.write(filePath, updated);
}

/** The names an import or export declaration binds from its module. */
function boundNamesOf(specifier: StringLiteral): string[] {
  return query<ImportSpecifier | ExportSpecifier>(
    specifier.parent,
    'ImportSpecifier, ExportSpecifier'
  ).map((element) => (element.propertyName ?? element.name).text);
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
