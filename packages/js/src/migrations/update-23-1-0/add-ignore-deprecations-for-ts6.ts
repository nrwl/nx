import {
  formatFiles,
  logger,
  type Tree,
  visitNotIgnoredFiles,
} from '@nx/devkit';
import { basename, dirname } from 'node:path';
import {
  applyEdits,
  modify,
  parseTree,
  findNodeAtLocation,
  getNodeValue,
} from 'jsonc-parser';
import type * as ts from 'typescript';
import { ensureTypescript } from '../../utils/typescript/ensure-typescript';

const FORMATTING_OPTIONS = {
  formattingOptions: { keepLines: true, insertSpaces: true, tabSize: 2 },
};

let tsModule: typeof import('typescript');

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
 *    exactly "tsconfig.json", the name jest/ts-node auto-resolve (walking up from
 *    the config file) when they compile a config file such as jest.config.ts.
 *    ts-node injects a default `target: es5` when the config leaves it unset, and
 *    es5 is a TS6-deprecated value (TS5107); any deprecated option the config
 *    already carries fires too. The flag (which ts-node does not override) keeps
 *    that load silent. Set unconditionally (even on a clean or solution-style
 *    container), since any tsconfig.json is a potential loader target, and inert
 *    when nothing is deprecated. It cannot silence a module/moduleResolution
 *    mismatch (TS5110) when ts-node's forced `module: commonjs` meets an
 *    inherited `nodenext` resolution.
 *
 * Loop B - direct-deprecation pass - adds "ignoreDeprecations": "6.0" to any
 * compilerOptions (or ts-node.compilerOptions) block that directly carries a TS6
 * hard-deprecated value (moduleResolution node/node10/classic, baseUrl, target
 * es5, esModuleInterop false, outFile, module amd/umd/system/none, alwaysStrict
 * false, allowSyntheticDefaultImports false, downlevelIteration set), including
 * the "esModuleInterop": false Loop A just pinned. A block that inherits an
 * effective "6.0" and sets no local flag is left alone; a stale local value
 * ("5.0") is upgraded, since it would override the inherited flag and still error.
 */
export default async function (tree: Tree) {
  tsModule ??= ensureTypescript();
  const ts = tsModule;
  // Tree-backed host so TypeScript resolves `extends` against Loop A's pending
  // writes; the `readDirectory` no-op skips the source-file scan, since only the
  // merged compilerOptions matter here, not the file list.
  const parseHost: ts.ParseConfigHost = {
    ...ts.sys,
    readFile: (filePath) => tree.read(filePath, 'utf-8') ?? undefined,
    readDirectory: () => [],
  };

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

  // Loop B - silence a deprecated value (directly set or inherited) unless an
  // inherited "6.0" already covers a block with no local override, upgrading a
  // stale local flag that would. Runs after Loop A so ancestor flags are in place.
  let deprecationCount = 0;
  for (const filePath of tsconfigPaths) {
    if (addIgnoreDeprecations(tree, ts, parseHost, filePath)) {
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
// target: ts-node/jest walk up for that name and compile it (e.g. jest.config.ts).
// ts-node injects a deprecated default `target: es5` when the config leaves it
// unset, so the load hits a TS6 deprecation error even on an otherwise clean
// config. Set `ignoreDeprecations` directly so the load stays silent regardless
// of `extends` or solution-container shape. Inert when nothing is deprecated.
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

function addIgnoreDeprecations(
  tree: Tree,
  ts: typeof import('typescript'),
  parseHost: ts.ParseConfigHost,
  tsconfigPath: string
): boolean {
  const original = tree.read(tsconfigPath, 'utf-8');
  if (!original) {
    return false;
  }

  // Effective inheritance through "extends": whether an ancestor provides a "6.0"
  // flag (which silences a block that sets no local value) and whether one
  // carries a deprecated value (which reaches this file through the merged
  // config).
  const { providesFlag6, providesDeprecated } = inheritedDeprecationState(
    tree,
    ts,
    parseHost,
    tsconfigPath
  );

  // The main block's own flag and deprecated state drive how the ts-node block
  // inherits. ts-node overlays the file's resolved main options (main, then
  // ts-node.compilerOptions), so the ts-node block inherits the main block's
  // effective flag, not the ancestor's directly: a local main value (e.g. "5.0")
  // overrides the inherited "6.0" the ts-node block would otherwise receive, and
  // a deprecated value in main reaches the ts-node block too.
  const mainOptions = readBlock(original, ['compilerOptions']);
  const mainFlag = mainOptions?.ignoreDeprecations;
  const mainOwnDeprecated = mainOptions
    ? hasDeprecatedValue(mainOptions)
    : false;

  const blocks: Array<{
    path: string[];
    inherited6: boolean;
    inheritedDeprecated: boolean;
  }> = [
    {
      path: ['compilerOptions'],
      inherited6: providesFlag6,
      inheritedDeprecated: providesDeprecated,
    },
    {
      path: ['ts-node', 'compilerOptions'],
      inherited6: mainFlag == null && providesFlag6,
      inheritedDeprecated: providesDeprecated || mainOwnDeprecated,
    },
  ];

  let contents = original;
  let changed = false;
  for (const { path, inherited6, inheritedDeprecated } of blocks) {
    // Re-parse each iteration: a prior edit shifts offsets in `contents`.
    const root = parseTree(contents);
    const blockNode = root && findNodeAtLocation(root, path);
    if (!blockNode || blockNode.type !== 'object') {
      continue;
    }
    const compilerOptions = getNodeValue(blockNode) as CompilerOptions;

    const localFlag = compilerOptions.ignoreDeprecations;
    // Only "6.0" already silences everything; any other local value does not.
    if (localFlag === '6.0') {
      continue;
    }
    // Nothing deprecated is in effect here, directly or inherited: nothing to
    // silence.
    if (!hasDeprecatedValue(compilerOptions) && !inheritedDeprecated) {
      continue;
    }
    // An unset local value inherits the "6.0". A local non-"6.0" value (e.g.
    // "5.0") overrides it and must be upgraded, so only skip when there is no
    // local value to override.
    if (localFlag == null && inherited6) {
      continue;
    }

    const edits = modify(
      contents,
      [...path, 'ignoreDeprecations'],
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

// Reads a compilerOptions block's value, or undefined when absent or non-object.
function readBlock(
  contents: string,
  blockPath: string[]
): CompilerOptions | undefined {
  const root = parseTree(contents);
  const node = root && findNodeAtLocation(root, blockPath);
  if (!node || node.type !== 'object') {
    return undefined;
  }
  return getNodeValue(node) as CompilerOptions;
}

// Reports two things about the ancestors reached through "extends", letting
// TypeScript resolve and merge the chain (array, package, and case forms
// included) instead of walking it by hand:
//  - providesFlag6: an ancestor yields an effective `ignoreDeprecations: "6.0"`
//    - it carries the flag directly, or carries a deprecated value this migration
//    flags with "6.0" in the same run. Either silences a descendant block that
//    sets no local flag.
//  - providesDeprecated: an ancestor carries a deprecated value, which reaches
//    this file through the merged config. A descendant that pins a stale local
//    "5.0" still errors on it, so that local value must be upgraded.
// Only the main compilerOptions is inherited via "extends". A missing or
// unresolvable parent yields empty options, i.e. neither, so the worst case is a
// harmless redundant flag, never an unsilenced deprecation.
function inheritedDeprecationState(
  tree: Tree,
  ts: typeof import('typescript'),
  parseHost: ts.ParseConfigHost,
  tsconfigPath: string
): { providesFlag6: boolean; providesDeprecated: boolean } {
  const contents = tree.read(tsconfigPath, 'utf-8');
  const root = contents ? parseTree(contents) : undefined;
  const extendsValue =
    root && root.type === 'object'
      ? (getNodeValue(root) as Record<string, unknown>).extends
      : undefined;
  if (extendsValue == null) {
    return { providesFlag6: false, providesDeprecated: false };
  }

  // Parsing an "extends"-only config yields exactly the inherited compilerOptions,
  // merged across the whole chain by TypeScript.
  const inherited = ts.parseJsonConfigFileContent(
    { extends: extendsValue },
    parseHost,
    dirname(tsconfigPath)
  ).options;

  const providesDeprecated = hasDeprecatedOption(ts, inherited);
  const providesFlag6 =
    inherited.ignoreDeprecations === '6.0' || providesDeprecated;
  return { providesFlag6, providesDeprecated };
}

// `hasDeprecatedValue` for parsed (extends-merged) compilerOptions, where
// TypeScript has normalized enum-valued options: `moduleResolution` "node"/
// "node10" to Node10, `target` "es5" to ES5, and so on. Unset options stay
// undefined (TypeScript does not fill in the module-derived `moduleResolution`
// default here), so an implied resolution is not misread as deprecated. Keep in
// sync with `hasDeprecatedValue`.
function hasDeprecatedOption(
  ts: typeof import('typescript'),
  options: ts.CompilerOptions
): boolean {
  const moduleResolution = options.moduleResolution;
  if (
    moduleResolution === ts.ModuleResolutionKind.Node10 ||
    moduleResolution === ts.ModuleResolutionKind.Classic
  ) {
    return true;
  }
  if (options.baseUrl != null) {
    return true;
  }
  if (options.target === ts.ScriptTarget.ES5) {
    return true;
  }
  if (options.esModuleInterop === false) {
    return true;
  }
  if (options.outFile != null) {
    return true;
  }
  const module = options.module;
  if (
    module === ts.ModuleKind.AMD ||
    module === ts.ModuleKind.UMD ||
    module === ts.ModuleKind.System ||
    module === ts.ModuleKind.None
  ) {
    return true;
  }
  if (options.alwaysStrict === false) {
    return true;
  }
  if (options.allowSyntheticDefaultImports === false) {
    return true;
  }
  if (options.downlevelIteration != null) {
    return true;
  }
  return false;
}

// Whether a file's own compilerOptions block (raw JSON, as authored) carries a
// value that compiles silently on TS 5.8 but is a hard deprecation error
// (TS5101/TS5107) on TS 6.0 - derived by differential 5.8-vs-6.0 probing.
// `hasDeprecatedOption` is the counterpart for TypeScript-parsed, extends-merged
// options; keep the two in sync.
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
