import { forEach, FileEntry, Rule } from '@angular-devkit/schematics';

/**
 * Remove a file from the Virtual Schematic Tree
 */
export function deleteFile(from: string): Rule {
  return forEach((entry: FileEntry): FileEntry | null => {
    return entry.path === from ? null : entry;
  });
}
