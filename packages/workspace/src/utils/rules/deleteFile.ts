import { Rule, Tree } from '@angular-devkit/schematics';

/**
 * Remove a file from the Virtual Schematic Tree
 */
export function deleteFile(from: string): Rule {
  return (host: Tree) => host.delete(from);
}
