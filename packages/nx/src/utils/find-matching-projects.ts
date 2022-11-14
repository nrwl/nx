import minimatch = require('minimatch');

export function findMatchingProjects(
  patterns: string[],
  projectNames: string[]
): string[] {
  const selectedProjects: Set<string> = new Set();
  const excludedProjects: Set<string> = new Set();

  for (const nameOrGlob of patterns) {
    if (projectNames.includes(nameOrGlob)) {
      selectedProjects.add(nameOrGlob);
      continue;
    }

    const exclude = nameOrGlob.startsWith('!');
    const pattern = exclude ? nameOrGlob.substring(1) : nameOrGlob;

    const matchedProjectNames = minimatch.match(projectNames, pattern);

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
