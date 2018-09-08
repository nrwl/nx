import { filter, Rule } from '@angular-devkit/schematics';

/**
 * Exclude common paths from the working Tree
 */
export function excludeUnnecessaryFiles(): Rule {
  return filter(
    path =>
      !path.startsWith('/node_modules') &&
      !path.startsWith('/dist') &&
      !path.startsWith('/.git') &&
      !path.startsWith('/.vscode') &&
      !path.startsWith('/.idea')
  );
}
