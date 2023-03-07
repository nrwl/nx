/**
 * Replaces slashes with dashes
 *
 * @param path
 */
export function getNewProjectName(path: string): string {
  return path.replace(/\//g, '-');
}
