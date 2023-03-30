import minimatch = require('minimatch');
import { type ProjectGraphProjectNode } from '../config/project-graph';

const globCharacters = ['*', '|', '{', '}', '(', ')'];

/**
 * Find matching project names given a list of potential project names or globs.
 *
 * @param patterns A list of project names or globs to match against.
 * @param projects A map of {@link ProjectGraphProjectNode} by project name.
 * @returns
 */
export function findMatchingProjects(
  patterns: string[] = [],
  projects:
    | Record<string, ProjectGraphProjectNode>
    | Map<string, ProjectGraphProjectNode>
): string[] {
  const projectObject =
    projects instanceof Map ? Object.fromEntries(projects) : projects;
  const projectNames = Object.keys(projectObject);
  const patternObjects = patterns.map((pattern) => {
    let isExclude = false;
    if (pattern.startsWith('!')) {
      isExclude = true;
      pattern = pattern.substring(1);
    }
    let [value, type] = pattern.split(':').reverse();
    if (value.startsWith('!')) {
      isExclude ||= true;
      value = value.substring(1);
    }
    return {
      not: isExclude,
      type: type,
      value,
    };
  });

  const selectedProjects: Set<string> = new Set();
  const excludedProjects: Set<string> = new Set();

  for (const patternObject of patternObjects) {
    if (patternObject.value === '*') {
      projectNames.every((projectName) =>
        (patternObject.not ? excludedProjects : selectedProjects).add(
          projectName
        )
      );
      if (patternObjects.length === 1) continue;
    }

    if (patternObject.type === 'tag') {
      for (const projectName of projectNames) {
        const tags = projectObject[projectName].data.tags || [];

        if (tags.includes(patternObject.value)) {
          (patternObject.not ? excludedProjects : selectedProjects).add(
            projectName
          );
          continue;
        }

        if (!globCharacters.some((c) => patternObject.value.includes(c))) {
          continue;
        }

        if (minimatch.match(tags, patternObject.value).length)
          (patternObject.not ? excludedProjects : selectedProjects).add(
            projectName
          );
      }
      continue;
    }

    if (projectNames.includes(patternObject.value)) {
      (patternObject.not ? excludedProjects : selectedProjects).add(
        patternObject.value
      );
      continue;
    }

    if (!globCharacters.some((c) => patternObject.value.includes(c))) {
      continue;
    }

    const matchedProjectNames = minimatch.match(
      projectNames,
      patternObject.value
    );
    matchedProjectNames.every((projectName) =>
      (patternObject.not ? excludedProjects : selectedProjects).add(projectName)
    );
  }

  for (const project of excludedProjects) {
    selectedProjects.delete(project);
  }

  return Array.from(selectedProjects);
}
