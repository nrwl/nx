import minimatch = require('minimatch');

const globCharacters = ['*', '|', '{', '}', '(', ')'];

/**
 * Find matching project names given a list of potential project names or globs.
 *
 * @param patterns A list of project names or globs to match against.
 * @param projectNames An array containing the list of project names.
 * @param projectNamesSet A set containing the list of project names.
 * @returns
 */
export function findMatchingProjects(
  patterns: string[],
  projectNames: string[],
  projectNamesSet: Set<string>
): string[] {
  const selectedProjects: Set<string> = new Set();
  const excludedProjects: Set<string> = new Set();

  for (const nameOrGlob of patterns) {
    if (projectNamesSet.has(nameOrGlob)) {
      selectedProjects.add(nameOrGlob);
      continue;
    }

    if (!globCharacters.some((c) => nameOrGlob.includes(c))) {
      continue;
    }

    const exclude = nameOrGlob.startsWith('!');
    const pattern = exclude ? nameOrGlob.substring(1) : nameOrGlob;

    const matchedProjectNames =
      pattern === '*' ? projectNames : minimatch.match(projectNames, pattern);

    matchedProjectNames.forEach((matchedProjectName) => {
      if (exclude) {
        excludedProjects.add(matchedProjectName);
      } else {
        selectedProjects.add(matchedProjectName);
      }
    });
  }

  for (const project of excludedProjects) {
    selectedProjects.delete(project);
  }

  return Array.from(selectedProjects);
}
