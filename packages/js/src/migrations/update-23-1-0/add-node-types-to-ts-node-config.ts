import {
  formatFiles,
  logger,
  type Tree,
  visitNotIgnoredFiles,
} from '@nx/devkit';
import { basename } from 'node:path';
import {
  applyEdits,
  findNodeAtLocation,
  getNodeValue,
  modify,
  parseTree,
} from 'jsonc-parser';

const FORMATTING_OPTIONS = {
  formattingOptions: { keepLines: true, insertSpaces: true, tabSize: 2 },
};

type CompilerOptions = Record<string, unknown>;

/**
 * `add-ignore-deprecations-for-ts6` keeps `ts-node.compilerOptions` on
 * `moduleResolution: node10`, but under TS6 `node`/`node10`/`classic` no longer
 * auto-load `@types/node` the way TS 5.x did. ts-node compiles `jest.config.ts`
 * (which uses `module.exports`) with that block, so the `module` global
 * disappears - `jest.config.ts(2,1): TS2591: Cannot find name 'module'`.
 *
 * Add an explicit `"types": ["node"]` so node globals stay resolvable. Scoped to
 * the `ts-node` block only: the main `compilerOptions` drives the whole
 * project's type-checking, so pinning its `types` there would wrongly narrow it.
 * Gated to TS6 by `requires` in migrations.json.
 */
export default async function (tree: Tree) {
  let count = 0;
  visitNotIgnoredFiles(tree, '.', (filePath) => {
    const name = basename(filePath);
    if (!name.startsWith('tsconfig') || !name.endsWith('.json')) {
      return;
    }
    if (addNodeTypesToTsNodeBlock(tree, filePath)) {
      count += 1;
    }
  });

  if (count > 0) {
    logger.info(
      `Added "types": ["node"] to the ts-node compilerOptions of ${count} tsconfig file(s) so jest configs keep resolving node globals on TypeScript 6.`
    );
  }

  await formatFiles(tree);
}

function addNodeTypesToTsNodeBlock(tree: Tree, tsconfigPath: string): boolean {
  const original = tree.read(tsconfigPath, 'utf-8');
  if (!original) {
    return false;
  }

  const root = parseTree(original);
  const blockNode =
    root && findNodeAtLocation(root, ['ts-node', 'compilerOptions']);
  if (!blockNode || blockNode.type !== 'object') {
    return false;
  }

  const compilerOptions = getNodeValue(blockNode) as CompilerOptions;
  // Only node-style resolutions lose @types/node auto-discovery on TS6.
  const moduleResolution = String(
    compilerOptions.moduleResolution ?? ''
  ).toLowerCase();
  if (
    moduleResolution !== 'node' &&
    moduleResolution !== 'node10' &&
    moduleResolution !== 'classic'
  ) {
    return false;
  }
  // An explicit `types` (even `[]`) is the user's choice - leave it.
  if (compilerOptions.types !== undefined) {
    return false;
  }

  const edits = modify(
    original,
    ['ts-node', 'compilerOptions', 'types'],
    ['node'],
    FORMATTING_OPTIONS
  );
  tree.write(tsconfigPath, applyEdits(original, edits));
  return true;
}
