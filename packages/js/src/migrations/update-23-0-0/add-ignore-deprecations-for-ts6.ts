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
 * Adds `ignoreDeprecations: "6.0"` to tsconfig files whose own compilerOptions
 * (or `ts-node.compilerOptions`) directly carry a TS6-deprecated option value,
 * so the workspace keeps compiling on TypeScript 6 without behavior changes.
 * Only runs on TS6 workspaces (gated by `requires` in migrations.json), because
 * `ignoreDeprecations: "6.0"` is itself a hard error (TS5103) on TS 5.x.
 */
export default async function (tree: Tree) {
  let touchedCount = 0;
  visitNotIgnoredFiles(tree, '.', (filePath) => {
    const name = basename(filePath);
    if (!name.startsWith('tsconfig') || !name.endsWith('.json')) {
      return;
    }
    if (addIgnoreDeprecations(tree, filePath)) {
      touchedCount += 1;
    }
  });

  if (touchedCount > 0) {
    logger.info(
      `Added "ignoreDeprecations": "6.0" to ${touchedCount} tsconfig file(s) carrying TS6-deprecated options.`
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
    moduleValue === 'system'
  ) {
    return true;
  }

  return false;
}

function asLowerString(value: unknown): string | undefined {
  return typeof value === 'string' ? value.toLowerCase() : undefined;
}
