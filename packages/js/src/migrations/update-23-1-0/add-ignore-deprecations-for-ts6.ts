import {
  formatFiles,
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
 * Two independent passes over every tsconfig*.json in the workspace:
 *
 * 1. ignoreDeprecations pass - adds `ignoreDeprecations: "6.0"` to any
 *    compilerOptions (or ts-node.compilerOptions) block that directly carries a
 *    TS6 hard-deprecated option value (moduleResolution node/node10/classic,
 *    baseUrl, target es5, esModuleInterop false, outFile, module
 *    amd/umd/system/none, alwaysStrict false, allowSyntheticDefaultImports
 *    false, downlevelIteration set to any value).
 *
 * 2. default-preserving pass - for every chain root (no "extends" key), pins
 *    the TS6 compiler-option defaults that changed in a way that breaks existing
 *    workspaces back to their pre-TS6 value, but only when the root does not set
 *    them explicitly:
 *      - "strict": false - TS6 treats an absent "strict" as true; TS5 as false.
 *      - "noUncheckedSideEffectImports": false - TS6 defaults it to true, which
 *        turns a bare side-effect import of an asset lacking an ambient
 *        declaration (e.g. `import './styles.css'`) into a hard TS2882 error; it
 *        is a semantic diagnostic, not a deprecation, so `ignoreDeprecations`
 *        cannot silence it.
 *      - "types": ["*"]. TS6 loads no @types packages when `types` is unset,
 *        whereas TS5 loaded them all; the "*" wildcard restores that default so
 *        a config relying on it (e.g. ts-node type-checking jest.config.ts)
 *        keeps finding @types/node.
 *    Files with "extends" inherit from their chain root and are left untouched.
 *    Pure solution-style containers (root has `"files": []` and no "include")
 *    select no source files, so pinning there is noise and they are skipped.
 *
 * Only runs on TS6 workspaces (gated by `requires` in migrations.json), because
 * `ignoreDeprecations: "6.0"` is itself a hard error (TS5103) on TS 5.x.
 */
export default async function (tree: Tree) {
  let deprecationCount = 0;
  let defaultsPinCount = 0;
  visitNotIgnoredFiles(tree, '.', (filePath) => {
    const name = basename(filePath);
    if (!name.startsWith('tsconfig') || !name.endsWith('.json')) {
      return;
    }
    if (addIgnoreDeprecations(tree, filePath)) {
      deprecationCount += 1;
    }
    if (pinPreTs6Defaults(tree, filePath)) {
      defaultsPinCount += 1;
    }
  });

  if (deprecationCount > 0) {
    logger.info(
      `Added "ignoreDeprecations": "6.0" to ${deprecationCount} tsconfig file(s) carrying TS6-deprecated options.`
    );
  }
  if (defaultsPinCount > 0) {
    logger.info(
      `Pinned pre-TS6 compiler option defaults ("strict", "noUncheckedSideEffectImports", "types") on ${defaultsPinCount} tsconfig chain root(s) to preserve existing behavior.`
    );
  }

  await formatFiles(tree);
}

function addIgnoreDeprecations(tree: Tree, tsconfigPath: string): boolean {
  const original = tree.read(tsconfigPath, 'utf-8');
  if (!original) {
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
