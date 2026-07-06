import {
  formatFiles,
  joinPathFragments,
  logger,
  type Tree,
  visitNotIgnoredFiles,
} from '@nx/devkit';
import { basename } from 'node:path';
import {
  applyEdits,
  modify,
  parseTree,
  findNodeAtLocation,
  getNodeValue,
} from 'jsonc-parser';

const FORMATTING_OPTIONS = {
  formattingOptions: { keepLines: true, insertSpaces: true, tabSize: 2 },
};

type CompilerOptions = Record<string, unknown>;

/**
 * Runs on TS6 workspaces (gated by `requires` in migrations.json) in two loops.
 *
 * Loop A writes the flags Loop B's inheritance check reads:
 *  - Default-preserving pins - for every chain root (no "extends") that is not a
 *    pure solution container ("files": [] and no "include"), pin the TS6 defaults
 *    that changed in a breaking way, but only where the root does not set them:
 *      - "strict": false - TS6 treats an absent "strict" as true; TS5 as false.
 *      - "noUncheckedSideEffectImports": false - TS6 defaults it true, turning a
 *        bare side-effect import of an asset without an ambient declaration
 *        (`import './styles.css'`) into a hard TS2882; a semantic diagnostic, not
 *        a deprecation, so `ignoreDeprecations` cannot silence it.
 *      - "types": ["*"] - TS6 loads no @types when `types` is unset (TS5 loaded
 *        all); the wildcard restores that so a config relying on it (ts-node
 *        type-checking jest.config.ts) keeps finding @types/node.
 *      - "esModuleInterop": false - TS6 flips the default false->true, changing
 *        `import * as x from '<cjs>'` call semantics at runtime; false preserves
 *        the pre-TS6 behavior. It is itself deprecated (removed in TS7), so Loop
 *        B silences it, deferring the interop change to the eventual TS7
 *        migration.
 *  - Config-load flag - set "ignoreDeprecations": "6.0" on every file named
 *    exactly "tsconfig.json". That is the name jest/ts-node auto-resolve (walking
 *    up from the config file) and load with a forced `module: commonjs`, which on
 *    TS6 pairs with the deprecated `node10` resolution; the flag keeps that load
 *    silent. Set unconditionally (even on a clean or solution-style container),
 *    since any tsconfig.json is a potential loader target, and inert when nothing
 *    is deprecated.
 *
 * Loop B - direct-deprecation pass - adds "ignoreDeprecations": "6.0" to any
 * compilerOptions (or ts-node.compilerOptions) block that directly carries a TS6
 * hard-deprecated value (moduleResolution node/node10/classic, baseUrl, target
 * es5, esModuleInterop false, outFile, module amd/umd/system/none, alwaysStrict
 * false, allowSyntheticDefaultImports false, downlevelIteration set), including
 * the "esModuleInterop": false Loop A just pinned. Skipped when an ancestor via
 * "extends" already provides the flag, so an inheriting file is not flagged
 * twice.
 */
export default async function (tree: Tree) {
  const tsconfigPaths: string[] = [];
  let defaultsPinCount = 0;
  let configLoadCount = 0;

  // Loop A - collect every tsconfig, pin pre-TS6 defaults on chain roots, and
  // ensure the config-load flag on every "tsconfig.json". These writes are what
  // Loop B's `extends`-inheritance check reads.
  visitNotIgnoredFiles(tree, '.', (filePath) => {
    const name = basename(filePath);
    if (!name.startsWith('tsconfig') || !name.endsWith('.json')) {
      return;
    }
    tsconfigPaths.push(filePath);
    if (pinPreTs6Defaults(tree, filePath)) {
      defaultsPinCount += 1;
    }
    if (
      name === 'tsconfig.json' &&
      ensureConfigLoadIgnoreDeprecations(tree, filePath)
    ) {
      configLoadCount += 1;
    }
  });

  // Loop B - silence a directly-set deprecated value, unless the flag is already
  // inherited. Runs after Loop A so ancestor flags are already in place.
  let deprecationCount = 0;
  for (const filePath of tsconfigPaths) {
    if (addIgnoreDeprecations(tree, filePath)) {
      deprecationCount += 1;
    }
  }

  if (configLoadCount > 0) {
    logger.info(
      `Ensured "ignoreDeprecations": "6.0" on ${configLoadCount} "tsconfig.json" file(s) so config loaders (jest/ts-node) keep working on TypeScript 6.`
    );
  }
  if (deprecationCount > 0) {
    logger.info(
      `Added "ignoreDeprecations": "6.0" to ${deprecationCount} tsconfig file(s) carrying TS6-deprecated options.`
    );
  }
  if (defaultsPinCount > 0) {
    logger.info(
      `Pinned pre-TS6 compiler option defaults ("strict", "noUncheckedSideEffectImports", "types", "esModuleInterop") on ${defaultsPinCount} tsconfig chain root(s).`
    );
  }

  await formatFiles(tree);
}

// Every file named exactly "tsconfig.json" is a config-loader auto-resolve
// target: ts-node/jest walk up for that name and compile it with a forced
// `module: commonjs`, which defaults to the deprecated `node10` resolution on
// TS6. Set `ignoreDeprecations` directly so the load stays silent regardless of
// `extends` or solution-container shape. Inert when nothing is deprecated.
function ensureConfigLoadIgnoreDeprecations(
  tree: Tree,
  tsconfigPath: string
): boolean {
  const original = tree.read(tsconfigPath, 'utf-8');
  if (!original) {
    return false;
  }

  const root = parseTree(original);
  if (!root || root.type !== 'object') {
    return false;
  }

  const compilerOptionsNode = findNodeAtLocation(root, ['compilerOptions']);
  // A present-but-non-object compilerOptions can't receive the key; bail so
  // modify() doesn't throw and abort the whole migration.
  if (compilerOptionsNode && compilerOptionsNode.type !== 'object') {
    return false;
  }
  const compilerOptions = compilerOptionsNode
    ? (getNodeValue(compilerOptionsNode) as CompilerOptions)
    : {};
  if (compilerOptions.ignoreDeprecations === '6.0') {
    return false;
  }

  const edits = modify(
    original,
    ['compilerOptions', 'ignoreDeprecations'],
    '6.0',
    FORMATTING_OPTIONS
  );
  tree.write(tsconfigPath, applyEdits(original, edits));

  return true;
}

function addIgnoreDeprecations(tree: Tree, tsconfigPath: string): boolean {
  const original = tree.read(tsconfigPath, 'utf-8');
  if (!original) {
    return false;
  }

  // A flag on an ancestor (via "extends") already silences a deprecated value
  // this file sets directly, so don't set it again here.
  if (inheritsIgnoreDeprecations(tree, tsconfigPath)) {
    return false;
  }

  // Each entry targets a distinct compilerOptions block within the same file.
  const blocks: string[][] = [
    ['compilerOptions'],
    ['ts-node', 'compilerOptions'],
  ];

  let contents = original;
  let changed = false;
  for (const blockPath of blocks) {
    // Re-parse each iteration: a prior edit shifts offsets in `contents`.
    const root = parseTree(contents);
    const blockNode = root && findNodeAtLocation(root, blockPath);
    if (!blockNode || blockNode.type !== 'object') {
      continue;
    }
    const compilerOptions = getNodeValue(blockNode) as CompilerOptions;
    if (!hasDeprecatedValue(compilerOptions)) {
      continue;
    }
    // An existing non-"6.0" value (e.g. "5.0") does NOT silence 6.0-class
    // deprecations, so upgrade it; only "6.0" is already correct.
    if (compilerOptions.ignoreDeprecations === '6.0') {
      continue;
    }

    const edits = modify(
      contents,
      [...blockPath, 'ignoreDeprecations'],
      '6.0',
      FORMATTING_OPTIONS
    );
    contents = applyEdits(contents, edits);
    changed = true;
  }

  if (changed) {
    tree.write(tsconfigPath, contents);
  }

  return changed;
}

// Walks the "extends" chain (best-effort: only relative-path parents are
// resolvable within the tree) and reports whether an ancestor already provides
// an effective `ignoreDeprecations: "6.0"`. An ancestor provides it when its
// compilerOptions already carries the flag, or carries a deprecated value this
// migration flags in the same run - both propagate to descendants through the
// merged config. Only the main compilerOptions is inherited via "extends" (a
// ts-node block is not), so only that block is inspected. An unresolvable parent
// counts as "not inherited", so the worst case is a harmless redundant flag,
// never an unsilenced deprecation.
function inheritsIgnoreDeprecations(
  tree: Tree,
  tsconfigPath: string,
  seen = new Set<string>()
): boolean {
  const contents = tree.read(tsconfigPath, 'utf-8');
  if (!contents) {
    return false;
  }
  const root = parseTree(contents);
  if (!root || root.type !== 'object') {
    return false;
  }

  const extendsValue = (getNodeValue(root) as Record<string, unknown>).extends;
  const parents = Array.isArray(extendsValue)
    ? extendsValue
    : extendsValue != null
      ? [extendsValue]
      : [];

  for (const parent of parents) {
    // Non-relative (package) parents can't be resolved within the tree.
    if (typeof parent !== 'string' || !parent.startsWith('.')) {
      continue;
    }
    const parentPath = resolveExtendsPath(tree, tsconfigPath, parent);
    if (!parentPath || seen.has(parentPath)) {
      continue;
    }
    seen.add(parentPath);

    const parentContents = tree.read(parentPath, 'utf-8');
    if (!parentContents) {
      continue;
    }
    const parentRoot = parseTree(parentContents);
    const parentOptionsNode =
      parentRoot && findNodeAtLocation(parentRoot, ['compilerOptions']);
    if (parentOptionsNode?.type === 'object') {
      const parentOptions = getNodeValue(parentOptionsNode) as CompilerOptions;
      if (
        parentOptions.ignoreDeprecations === '6.0' ||
        hasDeprecatedValue(parentOptions)
      ) {
        return true;
      }
    }
    if (inheritsIgnoreDeprecations(tree, parentPath, seen)) {
      return true;
    }
  }

  return false;
}

// Resolves a relative "extends" target to a tree path. TS allows omitting the
// ".json" extension and pointing at a directory (implying its "tsconfig.json").
function resolveExtendsPath(
  tree: Tree,
  fromPath: string,
  extendsValue: string
): string | undefined {
  const fromDir = fromPath.includes('/')
    ? fromPath.slice(0, fromPath.lastIndexOf('/'))
    : '.';
  const base = joinPathFragments(fromDir, extendsValue);
  const candidates = [
    base,
    `${base}.json`,
    joinPathFragments(base, 'tsconfig.json'),
  ];
  return candidates.find((candidate) => tree.exists(candidate));
}

// Values that compile silently on TS 5.8 but are hard deprecation errors
// (TS5101/TS5107) on TS 6.0 - derived by differential 5.8-vs-6.0 probing.
function hasDeprecatedValue(compilerOptions: CompilerOptions): boolean {
  const moduleResolution = asLowerString(compilerOptions.moduleResolution);
  if (
    moduleResolution === 'node' ||
    moduleResolution === 'node10' ||
    moduleResolution === 'classic'
  ) {
    return true;
  }

  // `baseUrl`/`outFile` only deprecate when set to a real value; `null`/unset
  // is inert on TS6.
  if (compilerOptions.baseUrl != null) {
    return true;
  }

  if (asLowerString(compilerOptions.target) === 'es5') {
    return true;
  }

  if (compilerOptions.esModuleInterop === false) {
    return true;
  }

  if (compilerOptions.outFile != null) {
    return true;
  }

  const moduleValue = asLowerString(compilerOptions.module);
  if (
    moduleValue === 'amd' ||
    moduleValue === 'umd' ||
    moduleValue === 'system' ||
    moduleValue === 'none'
  ) {
    return true;
  }

  // Only the explicit `false` value triggers TS5107 for these two flags.
  if (compilerOptions.alwaysStrict === false) {
    return true;
  }
  if (compilerOptions.allowSyntheticDefaultImports === false) {
    return true;
  }

  // A real boolean triggers TS5101; `null`/unset is inert. `!= null` also flags
  // non-boolean JSON, but that only adds a harmless no-op `ignoreDeprecations`.
  if (compilerOptions.downlevelIteration != null) {
    return true;
  }

  return false;
}

// TS6 compiler-option defaults that changed in a way that breaks existing
// workspaces. We pin each back to its pre-TS6 value on chain roots that don't
// set it, so existing workspaces keep building without adopting a legit TS6
// setup.
const DEFAULT_PRESERVING_PINS: ReadonlyArray<[string, boolean | string[]]> = [
  ['strict', false],
  ['noUncheckedSideEffectImports', false],
  // TS6 loads no @types when `types` is unset (TS5 loaded all); "*" restores it.
  ['types', ['*']],
  // TS6 flips esModuleInterop's default false->true, changing `import * as
  // <cjs>` call semantics at runtime; false preserves pre-TS6 behavior. It is
  // itself deprecated (removed in TS7), so the deprecation pass (Loop B)
  // silences it. See the file-level doc for the ordering rationale.
  ['esModuleInterop', false],
];

function pinPreTs6Defaults(tree: Tree, tsconfigPath: string): boolean {
  const original = tree.read(tsconfigPath, 'utf-8');
  if (!original) {
    return false;
  }

  const root = parseTree(original);
  if (!root || root.type !== 'object') {
    return false;
  }

  const rootValue = getNodeValue(root) as Record<string, unknown>;

  // Only touch chain roots - files with "extends" inherit from their ancestor.
  if ('extends' in rootValue) {
    return false;
  }

  // Skip pure solution-style containers: root has "files": [] and no "include".
  // They select no source files, so pinning defaults there is noise.
  const filesNode = findNodeAtLocation(root, ['files']);
  const hasEmptyFiles =
    filesNode?.type === 'array' && filesNode.children?.length === 0;
  if (hasEmptyFiles && !('include' in rootValue)) {
    return false;
  }

  const compilerOptionsNode = findNodeAtLocation(root, ['compilerOptions']);
  // A present-but-non-object compilerOptions can't receive pinned keys; bailing
  // avoids modify() throwing and aborting the whole migration.
  if (compilerOptionsNode && compilerOptionsNode.type !== 'object') {
    return false;
  }
  const compilerOptions = compilerOptionsNode
    ? (getNodeValue(compilerOptionsNode) as CompilerOptions)
    : {};

  let contents = original;
  let changed = false;
  for (const [key, value] of DEFAULT_PRESERVING_PINS) {
    // An explicit value means the user opted in; leave it.
    if (key in compilerOptions) {
      continue;
    }
    const edits = modify(
      contents,
      ['compilerOptions', key],
      value,
      FORMATTING_OPTIONS
    );
    contents = applyEdits(contents, edits);
    changed = true;
  }

  if (changed) {
    tree.write(tsconfigPath, contents);
  }

  return changed;
}

function asLowerString(value: unknown): string | undefined {
  return typeof value === 'string' ? value.toLowerCase() : undefined;
}
