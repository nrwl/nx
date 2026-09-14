import { realpathSync } from 'node:fs';
import * as path from 'node:path';
import type { WorkspacePackage } from '../../plugins/js/utils/packages';

/**
 * Compares by realpath when available so symlinks and root aliases agree;
 * installed `node_modules` paths stay external.
 */
export function isWorkspaceLocalResolution(
  resolvedPath: string,
  root: string
): boolean {
  const normalizedRoot = canonicalPath(path.normalize(root));
  const normalizedPath = canonicalPath(path.normalize(resolvedPath));
  return (
    normalizedPath.startsWith(normalizedRoot + path.sep) &&
    !normalizedPath.includes(path.sep + 'node_modules' + path.sep)
  );
}

// A missing file resolves through its nearest existing ancestor so an aliased
// root still yields the real spelling.
export function canonicalPath(p: string): string {
  const rest: string[] = [];
  let current = p;
  while (true) {
    try {
      return path.join(realpathSync(current), ...rest);
    } catch {
      const parent = path.dirname(current);
      if (parent === current) {
        return p;
      }
      rest.unshift(path.basename(current));
      current = parent;
    }
  }
}

function ownerOf<T extends { root: string }>(
  canonicalTarget: string,
  packages: T[]
): T | undefined {
  let owner: T | undefined;
  for (const pkg of packages) {
    if (
      canonicalTarget.startsWith(pkg.root + path.sep) &&
      (!owner || pkg.root.length > owner.root.length)
    ) {
      owner = pkg;
    }
  }
  return owner;
}

/**
 * Adds build/source guidance when a workspace-local built entry cannot resolve
 * a workspace package that is neither the entry's own project nor an ancestor
 * or descendant of it, nor the package whose directory holds the entry. Build
 * output may live outside its project root, so those cases are ambiguous and
 * get no hint, and neither does an entry whose project is unknown. The
 * original error stays as cause and message.
 */
export function withBuiltEntryResolutionHint(
  error: unknown,
  entry: { path: string; projectRoot: string | undefined },
  root: string,
  workspacePackages: WorkspacePackage[]
): unknown {
  const code = (error as { code?: string })?.code;
  if (
    entry.projectRoot === undefined ||
    (code !== 'MODULE_NOT_FOUND' && code !== 'ERR_MODULE_NOT_FOUND') ||
    !isWorkspaceLocalResolution(entry.path, root)
  ) {
    return error;
  }
  const message = (error as Error).message ?? '';
  const missing = message.match(/'([^']+)'/)?.[1];
  if (!missing) {
    return error;
  }
  const canonicalRoot = canonicalPath(root);
  const packages = workspacePackages.map((pkg) => ({
    name: pkg.name,
    projectRoot: pkg.root,
    root: canonicalPath(path.join(canonicalRoot, pkg.root)),
  }));
  const canonicalEntry = canonicalPath(entry.path);
  let owner: { projectRoot: string; root: string } | undefined;
  let target: string;
  if (path.isAbsolute(missing)) {
    const canonicalMissing = canonicalPath(missing);
    owner = isWorkspaceLocalResolution(canonicalMissing, canonicalRoot)
      ? ownerOf(canonicalMissing, packages)
      : undefined;
    if (owner && canonicalEntry.startsWith(owner.root + path.sep)) {
      return error;
    }
    target = path.relative(canonicalRoot, canonicalMissing);
  } else {
    const packageName = missing.startsWith('@')
      ? missing.split('/').slice(0, 2).join('/')
      : missing.split('/')[0];
    owner = packages.find((pkg) => pkg.name === packageName);
    target = missing;
  }
  if (!owner || isNestedRoot(owner.projectRoot, entry.projectRoot)) {
    return error;
  }
  return new Error(
    `${message}\n\n"${target}" was requested from "${path.relative(
      canonicalRoot,
      canonicalEntry
    )}", which Nx loaded from its build output, so its imports resolve to ` +
      `build outputs too. Build the workspace packages it depends on, or ` +
      `expose its source through an "exports" condition listed in the root ` +
      `tsconfig "customConditions" so Nx loads it from source.`,
    { cause: error }
  );
}

function isNestedRoot(a: string, b: string): boolean {
  return contains(a, b) || contains(b, a);
}

function contains(parent: string, child: string): boolean {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}
