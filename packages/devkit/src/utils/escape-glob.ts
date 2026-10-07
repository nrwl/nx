const GLOB_METACHARACTERS = /[\\*?[\]{}()!]/g;

/**
 * Escapes the glob syntax in a path so that, used as a task input, it
 * matches only that path. Nx reads every fileset input as a glob, so a real
 * path like `app/(group)/page.tsx` or `tools/[setup].mts` would otherwise
 * match other files, or none.
 *
 * Escape only the path, and append any pattern after it:
 *
 * ```typescript
 * `{workspaceRoot}/${escapeGlob(setupFile)}`
 * `{workspaceRoot}/${escapeGlob(configDir)}/*.json`
 * ```
 *
 * @param path - a workspace-relative path, using `/` separators
 */
export function escapeGlob(path: string): string {
  return path.replace(GLOB_METACHARACTERS, '\\$&');
}
