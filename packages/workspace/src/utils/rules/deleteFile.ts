import type { Rule, Tree } from '@angular-devkit/schematics';

/**
 * Remove a file from the Virtual Schematic Tree
 * @deprecated This will be removed in v17. Prefer writing Nx Generators with @nrwl/devkit. This function can be replaced with 'Tree.delete' from @nrwl/devkit.
 */
export function deleteFile(from: string): Rule {
  return (host: Tree) => host.delete(from);
}
