import { formatFiles, globAsync, logger, type Tree } from '@nx/devkit';
import { basename, dirname } from 'node:path';
import { applyEdits, getNodeValue, modify, parseTree } from 'jsonc-parser';
import type * as ts from 'typescript';
import { ensureTypescript } from '../../utils/typescript/ensure-typescript';

const FORMATTING_OPTIONS = {
  formattingOptions: { keepLines: true, insertSpaces: true, tabSize: 2 },
};

let tsModule: typeof import('typescript');

type CompilerOptions = Record<string, unknown>;

/**
 * Runs on TypeScript 6 workspaces (gated by `requires` in migrations.json) in
 * two passes over every `tsconfig*.json`.
 *
 * Pass 1 writes what pass 2's `extends` resolution reads back:
 *  - Default-preserving pins: on every chain root (no `extends`) that is not a
 *    pure solution container (`files: []` with no `include`), pin the TS6
 *    defaults that changed in a breaking way, but only where the root leaves
 *    them unset:
 *      - `strict: false`. TS6 treats an absent `strict` as true, TS5 as false.
 *      - `noUncheckedSideEffectImports: false`. TS6 defaults it true, turning a
 *        bare side-effect import of an asset without an ambient declaration
 *        (`import './styles.css'`) into a hard TS2882; a semantic diagnostic,
 *        not a deprecation, so `ignoreDeprecations` cannot silence it.
 *      - `types: ["*"]`. TS6 loads no @types when `types` is unset (TS5 loaded
 *        all); the wildcard restores that so a config relying on it (ts-node
 *        type-checking jest.config.ts) keeps finding @types/node.
 *      - `esModuleInterop: false`. TS6 flips the default false->true, changing
 *        `import * as x from '<cjs>'` call semantics at runtime; false preserves
 *        the pre-TS6 behavior. It is itself deprecated (removed in TS7), so pass
 *        2 silences it, deferring the interop change to the eventual TS7 work.
 *  - Config-load flag: set `ignoreDeprecations: "6.0"` on every file named
 *    exactly `tsconfig.json`, the name jest/ts-node auto-resolve (walking up
 *    from the file they compile, such as jest.config.ts). ts-node injects a
 *    `target: es5` when the config leaves it unset, and es5 is a TS6-deprecated
 *    value (TS5107); the flag (which ts-node passes through) keeps that load
 *    silent. Set unconditionally, since any `tsconfig.json` is a potential
 *    loader target, and inert when nothing is deprecated. It cannot silence a
 *    module/moduleResolution mismatch (TS5110) when ts-node's forced
 *    `module: commonjs` meets an inherited `nodenext` resolution.
 *
 * Pass 2 silences the remaining hard-deprecated values. For each config,
 * TypeScript resolves its `extends`-merged compiler options; when they carry a
 * value TS6 hard-deprecates (see `hasDeprecatedOption`) and their effective
 * `ignoreDeprecations` is not already `"6.0"`, add the flag. Because the check
 * runs on the merged options, it covers a value the config inherits from a base
 * this migration never edits, respects an inherited `"6.0"` (no redundant flag),
 * and upgrades a stale local `"5.0"` that overrides one. The
 * `ts-node.compilerOptions` overlay, which `tsc` does not merge, is checked on
 * its own.
 */
export default async function (tree: Tree) {
  tsModule ??= ensureTypescript();
  const ts = tsModule;
  // Tree-backed host so TypeScript resolves `extends` against pass 1's pending
  // writes; the `readDirectory` no-op skips the source-file scan, since only the
  // merged compiler options matter here, not the file list.
  const parseHost: ts.ParseConfigHost = {
    ...ts.sys,
    readFile: (filePath) => tree.read(filePath, 'utf-8') ?? undefined,
    readDirectory: () => [],
  };

  const tsconfigPaths = await globAsync(tree, ['**/tsconfig*.json']);

  // Pass 1: pins and config-load flags, so pass 2's inheritance check sees them.
  let defaultsPinCount = 0;
  let configLoadCount = 0;
  for (const tsconfigPath of tsconfigPaths) {
    const { pinned, flagged } = applyDefaultsAndConfigLoadFlag(
      tree,
      tsconfigPath
    );
    if (pinned) defaultsPinCount += 1;
    if (flagged) configLoadCount += 1;
  }

  // Pass 2: silence a deprecated value the config carries or inherits.
  let deprecationCount = 0;
  for (const tsconfigPath of tsconfigPaths) {
    if (silenceDeprecations(tree, ts, parseHost, tsconfigPath)) {
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

// The pre-TS6 default values pinned on chain roots that leave them unset; pass 1
// above explains why each one changed in a breaking way.
const DEFAULT_PRESERVING_PINS: ReadonlyArray<[string, boolean | string[]]> = [
  ['strict', false],
  ['noUncheckedSideEffectImports', false],
  ['types', ['*']],
  ['esModuleInterop', false],
];

// Pass 1 for one file: pin pre-TS6 defaults on a chain root and set the
// config-load flag on a `tsconfig.json`, combined into a single write.
function applyDefaultsAndConfigLoadFlag(
  tree: Tree,
  tsconfigPath: string
): { pinned: boolean; flagged: boolean } {
  const original = tree.read(tsconfigPath, 'utf-8');
  if (!original) {
    return { pinned: false, flagged: false };
  }
  const root = parseTree(original);
  if (!root || root.type !== 'object') {
    return { pinned: false, flagged: false };
  }
  const own = getNodeValue(root) as Record<string, unknown>;

  const compilerOptions = own.compilerOptions;
  // A present-but-non-object compilerOptions can't receive keys; leave the file
  // alone so modify() doesn't throw and abort the whole migration.
  if (compilerOptions !== undefined && !isObject(compilerOptions)) {
    return { pinned: false, flagged: false };
  }
  const options = (compilerOptions ?? {}) as CompilerOptions;

  let contents = original;
  let pinned = false;
  let flagged = false;

  // Only chain roots; a file with "extends" inherits the defaults. Skip pure
  // solution containers ("files": [] and no "include"): they select no sources.
  const isSolutionContainer =
    Array.isArray(own.files) && own.files.length === 0 && !('include' in own);
  if (own.extends === undefined && !isSolutionContainer) {
    for (const [key, value] of DEFAULT_PRESERVING_PINS) {
      if (key in options) continue; // An explicit value means the user opted in.
      contents = applyEdits(
        contents,
        modify(contents, ['compilerOptions', key], value, FORMATTING_OPTIONS)
      );
      pinned = true;
    }
  }

  if (
    basename(tsconfigPath) === 'tsconfig.json' &&
    options.ignoreDeprecations !== '6.0'
  ) {
    contents = applyEdits(
      contents,
      modify(
        contents,
        ['compilerOptions', 'ignoreDeprecations'],
        '6.0',
        FORMATTING_OPTIONS
      )
    );
    flagged = true;
  }

  if (pinned || flagged) {
    tree.write(tsconfigPath, contents);
  }
  return { pinned, flagged };
}

// Pass 2 for one file: silence a deprecated value it carries or inherits, in the
// main block and the ts-node overlay, combined into a single write.
function silenceDeprecations(
  tree: Tree,
  ts: typeof import('typescript'),
  parseHost: ts.ParseConfigHost,
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
  const own = getNodeValue(root) as Record<string, unknown>;

  const mainBlock = own.compilerOptions;
  const mainIsObject = isObject(mainBlock);
  const mainFlag = mainIsObject
    ? (mainBlock as CompilerOptions).ignoreDeprecations
    : undefined;

  const tsNodeBlock = isObject(own['ts-node'])
    ? (own['ts-node'] as Record<string, unknown>).compilerOptions
    : undefined;
  const tsNodeIsObject = isObject(tsNodeBlock);
  const tsNodeFlag = tsNodeIsObject
    ? (tsNodeBlock as CompilerOptions).ignoreDeprecations
    : undefined;

  // No own options and no `extends` to inherit through, and no overlay to check:
  // nothing can be deprecated here, so skip without parsing.
  if (!mainIsObject && own.extends === undefined && !tsNodeIsObject) {
    return false;
  }
  // Main is already silenced and there is no overlay: nothing to do, skip the
  // parse entirely (the common case for a config-load-flagged `tsconfig.json`).
  if (mainFlag === '6.0' && !tsNodeIsObject) {
    return false;
  }

  // The `extends`-merged main options, normalized by TypeScript. Passing the
  // config object (not the path) keeps TypeScript from re-reading this file; it
  // reads only the ancestors.
  const mainOptions = ts.parseJsonConfigFileContent(
    { extends: own.extends, compilerOptions: mainIsObject ? mainBlock : {} },
    parseHost,
    dirname(tsconfigPath)
  ).options;
  const mainDeprecated = hasDeprecatedOption(ts, mainOptions);

  let contents = original;
  let changed = false;

  // Main block: silence a deprecated value it carries or inherits, unless an
  // effective "6.0" (own or inherited) already covers it. A stale local "5.0"
  // that overrides an inherited "6.0" shows through the merge and is upgraded.
  // An absent block is created; a present-but-non-object one is left alone so
  // modify() neither corrupts it nor throws.
  const mainWritable = mainBlock === undefined || mainIsObject;
  if (
    mainWritable &&
    mainFlag !== '6.0' &&
    mainDeprecated &&
    mainOptions.ignoreDeprecations !== '6.0'
  ) {
    contents = applyEdits(
      contents,
      modify(
        contents,
        ['compilerOptions', 'ignoreDeprecations'],
        '6.0',
        FORMATTING_OPTIONS
      )
    );
    changed = true;
  }

  // ts-node overlay: `tsc` does not merge it, so check it directly. ts-node
  // overlays the resolved main options at runtime; a "6.0" the main block just
  // received does not reliably reach the overlay across ts-node versions, so
  // silence it on its own whenever it or the resolved main carries a deprecated
  // value.
  if (tsNodeIsObject && tsNodeFlag !== '6.0') {
    const overlayOptions = ts.parseJsonConfigFileContent(
      { compilerOptions: tsNodeBlock },
      parseHost,
      dirname(tsconfigPath)
    ).options;
    if (hasDeprecatedOption(ts, overlayOptions) || mainDeprecated) {
      contents = applyEdits(
        contents,
        modify(
          contents,
          ['ts-node', 'compilerOptions', 'ignoreDeprecations'],
          '6.0',
          FORMATTING_OPTIONS
        )
      );
      changed = true;
    }
  }

  if (changed) {
    tree.write(tsconfigPath, contents);
  }
  return changed;
}

// Whether TypeScript-parsed, `extends`-merged compiler options carry a value
// that compiles silently on TS 5.8 but is a hard deprecation error (TS5101/
// TS5107) on TS 6.0, derived by differential 5.8-vs-6.0 probing. Options are
// read from the normalized enums TypeScript produces; an unset option stays
// undefined (TypeScript does not fill in the module-derived `moduleResolution`
// default here), so an implied resolution is not misread as deprecated.
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

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
