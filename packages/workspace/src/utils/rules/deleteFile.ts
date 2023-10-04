import type { Rule, Tree } from '@angular-devkit/schematics';

/**
 * Remove a file from the Virtual Schematic Tree
 * @deprecated This will be removed in v17. Prefer writing Nx Generators with @nx/devkit. This function can be replaced with 'Tree.delete' from @nx/devkit.
 */
export function deleteFile(from: string): Rule {
  return (host: Tree) => host.delete(from);
}
