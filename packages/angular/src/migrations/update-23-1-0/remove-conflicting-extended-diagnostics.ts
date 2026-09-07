import {
  formatFiles,
  logger,
  type Tree,
  visitNotIgnoredFiles,
} from '@nx/devkit';
import { basename, posix } from 'node:path';
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

// Angular v22's `strict-safe-navigation-narrow` migration adds an
// `extendedDiagnostics` block to project tsconfigs unconditionally, while its
// `strict-templates-default` migration pins `strictTemplates: false` on
// workspaces that had not enabled strict templates. The Angular compiler rejects
// that combination (it errors when `extendedDiagnostics` is set and
// `strictTemplates` is `false`), so those projects fail to build. `@nx/angular`
// migrations run after Angular's, so we reconcile it here: drop the
// `extendedDiagnostics` block wherever `strictTemplates` resolves to `false`,
// preserving the intended `strictTemplates: false` behavior (enabling strict
// templates instead would change behavior and surface new template errors).
export default async function (tree: Tree) {
  let removedCount = 0;
  visitNotIgnoredFiles(tree, '.', (filePath) => {
    const name = basename(filePath);
    if (!name.startsWith('tsconfig') || !name.endsWith('.json')) {
      return;
    }
    if (removeConflictingExtendedDiagnostics(tree, filePath)) {
      removedCount += 1;
    }
  });

  if (removedCount > 0) {
    logger.info(
      `Removed the "extendedDiagnostics" Angular compiler option from ${removedCount} tsconfig file(s) where "strictTemplates" is disabled, resolving the conflict introduced by the Angular v22 template migrations.`
    );
  }

  await formatFiles(tree);
}

function removeConflictingExtendedDiagnostics(
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

  // Only touch files that locally declare `extendedDiagnostics`; the Angular
  // migration adds it to project tsconfigs, never to a shared base.
  const extendedDiagnosticsNode = findNodeAtLocation(root, [
    'angularCompilerOptions',
    'extendedDiagnostics',
  ]);
  if (!extendedDiagnosticsNode) {
    return false;
  }

  // The compiler errors only when the resolved `strictTemplates` is explicitly
  // `false` (an unset value doesn't trigger it), so mirror that exact condition.
  if (resolveStrictTemplates(tree, tsconfigPath) !== false) {
    return false;
  }

  const edits = modify(
    original,
    ['angularCompilerOptions', 'extendedDiagnostics'],
    undefined,
    FORMATTING_OPTIONS
  );
  tree.write(tsconfigPath, applyEdits(original, edits));

  return true;
}

// Resolves `angularCompilerOptions.strictTemplates` for a tsconfig, following
// the `extends` chain (a local value wins over an inherited one). TypeScript
// doesn't merge the non-standard `angularCompilerOptions`, so the chain is
// traversed manually, matching how the Angular compiler resolves it.
function resolveStrictTemplates(
  tree: Tree,
  tsconfigPath: string,
  seen = new Set<string>()
): boolean | undefined {
  if (seen.has(tsconfigPath)) {
    return undefined;
  }
  seen.add(tsconfigPath);

  const content = tree.read(tsconfigPath, 'utf-8');
  if (!content) {
    return undefined;
  }
  const root = parseTree(content);
  if (!root || root.type !== 'object') {
    return undefined;
  }

  const localNode = findNodeAtLocation(root, [
    'angularCompilerOptions',
    'strictTemplates',
  ]);
  if (localNode) {
    const value = getNodeValue(localNode);
    return typeof value === 'boolean' ? value : undefined;
  }

  const extendsNode = findNodeAtLocation(root, ['extends']);
  if (!extendsNode) {
    return undefined;
  }
  const extendsValue = getNodeValue(extendsNode);
  // `extends` can be a single path or an ordered array (later entries win).
  const parents = Array.isArray(extendsValue)
    ? [...extendsValue].reverse()
    : [extendsValue];
  for (const parent of parents) {
    const parentPath = resolveExtendsPath(tree, tsconfigPath, parent);
    if (!parentPath) {
      continue;
    }
    const resolved = resolveStrictTemplates(tree, parentPath, seen);
    if (resolved !== undefined) {
      return resolved;
    }
  }

  return undefined;
}

// Resolves a relative `extends` target to a workspace path within the tree.
// Package/`node_modules` bases (which never carry the migration's output) are
// skipped by returning null.
function resolveExtendsPath(
  tree: Tree,
  tsconfigPath: string,
  extendsValue: unknown
): string | null {
  if (typeof extendsValue !== 'string' || !extendsValue.startsWith('.')) {
    return null;
  }
  const base = posix.join(posix.dirname(tsconfigPath), extendsValue);
  const candidates = base.endsWith('.json') ? [base] : [base, `${base}.json`];
  return candidates.find((candidate) => tree.exists(candidate)) ?? null;
}
