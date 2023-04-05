import minimatch = require('minimatch');
import type { ProjectGraphProjectNode } from '../config/project-graph';

const globCharacters = ['*', '|', '{', '}', '(', ')'];

const validPatternTypes = [
  'name', // Pattern is based on the project's name
  'tag', // Pattern is based on the project's tags
] as const;
type ProjectPatternType = typeof validPatternTypes[number];

interface ProjectPattern {
  // If true, the pattern is an exclude pattern
  exclude: boolean;
  // The type of pattern to match against
  type: ProjectPatternType;
  // The pattern to match against
  value: string;
}

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
  const projectNames = keys(projects);

  const patternObjects: ProjectPattern[] = patterns.map((p) =>
    parseStringPattern(p, projects)
  );

  const selectedProjects: Set<string> = new Set();
  const excludedProjects: Set<string> = new Set();

  for (const pattern of patternObjects) {
    // Handle wildcard with short-circuit, as its a common case with potentially
    // large project sets and we can avoid the more expensive glob matching.
    if (pattern.value === '*') {
      for (const projectName of projectNames) {
        if (pattern.exclude) {
          excludedProjects.add(projectName);
        } else {
          selectedProjects.add(projectName);
        }
      }
      continue;
    }

    if (pattern.type === 'tag') {
      for (const projectName of projectNames) {
        const tags =
          getItemInMapOrRecord(projects, projectName).data.tags || [];

        if (tags.includes(pattern.value)) {
          (pattern.exclude ? excludedProjects : selectedProjects).add(
            projectName
          );
          continue;
        }

        if (!globCharacters.some((c) => pattern.value.includes(c))) {
          continue;
        }

        if (minimatch.match(tags, pattern.value).length)
          (pattern.exclude ? excludedProjects : selectedProjects).add(
            projectName
          );
      }
      continue;
    } else if (pattern.type === 'name') {
      if (hasKey(projects, pattern.value)) {
        (pattern.exclude ? excludedProjects : selectedProjects).add(
          pattern.value
        );
        continue;
      }

      if (!globCharacters.some((c) => pattern.value.includes(c))) {
        continue;
      }

      const matchedProjectNames = minimatch.match(projectNames, pattern.value);
      for (const projectName of matchedProjectNames) {
        if (pattern.exclude) {
          excludedProjects.add(projectName);
        } else {
          selectedProjects.add(projectName);
        }
      }
    }
  }

  for (const project of excludedProjects) {
    selectedProjects.delete(project);
  }

  return Array.from(selectedProjects);
}

function keys(
  object: Record<string, unknown> | Map<string, unknown>
): string[] {
  return object instanceof Map ? [...object.keys()] : Object.keys(object);
}

function hasKey(
  object: Record<string, unknown> | Map<string, unknown>,
  key: string
) {
  return object instanceof Map ? object.has(key) : key in object;
}

function getItemInMapOrRecord<T>(
  object: Record<string, T> | Map<string, T>,
  key: string
): T {
  return object instanceof Map ? object.get(key) : object[key];
}

function parseStringPattern(
  pattern: string,
  projects:
    | Map<string, ProjectGraphProjectNode>
    | Record<string, ProjectGraphProjectNode>
): ProjectPattern {
  let type: ProjectPatternType;
  let value: string;
  const isExclude = pattern.startsWith('!');

  // Support for things like: `!{type}:value`
  if (isExclude) {
    pattern = pattern.substring(1);
  }

  const indexOfFirstPotentialSeparator = pattern.indexOf(':');
  if (indexOfFirstPotentialSeparator === -1 || hasKey(projects, pattern)) {
    type = 'name';
    value = pattern;
  } else {
    const potentialType = pattern.substring(0, indexOfFirstPotentialSeparator);
    if (isValidPatternType(potentialType)) {
      type = potentialType;
      value = pattern.substring(indexOfFirstPotentialSeparator + 1);
    } else {
      type = 'name';
      value = pattern;
    }
  }

  return { type, value, exclude: isExclude };
}

function isValidPatternType(type: string): type is ProjectPatternType {
  return validPatternTypes.includes(type as ProjectPatternType);
}
