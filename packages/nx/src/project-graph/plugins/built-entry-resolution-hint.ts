import { realpathSync } from 'node:fs';
import * as path from 'node:path';

/**
 * Distinguishes a symlinked workspace package (where `require.resolve`
 * follows the package-manager symlink into the workspace source tree) from
 * a truly-installed dependency under `node_modules/`. The former needs the
 * source-first lookup to bypass the dist that Node would otherwise return.
 * Both sides are compared by realpath: Node reports resolved modules that
 * way, while the configured root may be an alias (`/tmp` vs `/private/tmp`).
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

function canonicalPath(p: string): string {
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
}

/**
 * A built entry runs under Node's own resolution, so a sibling workspace
 * package it cannot find is one whose build output does not exist yet.
 * Names the two ways out; the original error stays as the cause and its
 * message leads, since the daemon transports only the message.
 */
export function withBuiltEntryResolutionHint(
  error: unknown,
  entryPath: string,
  root: string,
  workspacePackageNames: string[]
): unknown {
  const code = (error as { code?: string })?.code;
  if (
    (code !== 'MODULE_NOT_FOUND' && code !== 'ERR_MODULE_NOT_FOUND') ||
    !isWorkspaceLocalResolution(entryPath, root)
  ) {
    return error;
  }
  const message = (error as Error).message ?? '';
  const missing = message.match(/'([^']+)'/)?.[1];
  if (!missing) {
    return error;
  }
  let target: string;
  if (path.isAbsolute(missing)) {
    if (!isWorkspaceLocalResolution(missing, root)) {
      return error;
    }
    target = path.relative(root, missing);
  } else {
    const packageName = missing.startsWith('@')
      ? missing.split('/').slice(0, 2).join('/')
      : missing.split('/')[0];
    if (!workspacePackageNames.includes(packageName)) {
      return error;
    }
    target = missing;
  }
  return new Error(
    `${message}\n\n"${target}" was requested from "${path.relative(
      root,
      entryPath
    )}", which Nx loaded from its build output, so its imports resolve to ` +
      `build outputs too. Build the workspace packages it depends on, or ` +
      `expose its source through an "exports" condition listed in the root ` +
      `tsconfig "customConditions" so Nx loads it from source.`,
    { cause: error }
  );
}
