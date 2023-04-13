import minimatch = require('minimatch');
import type { ProjectGraphProjectNode } from '../config/project-graph';

type ProjectNodeMap =
  | Record<string, ProjectGraphProjectNode>
  | Map<string, ProjectGraphProjectNode>;

const validPatternTypes = [
  'name', // Pattern is based on the project's name
  'tag', // Pattern is based on the project's tags
  'directory', // Pattern is based on the project's root directory
  'unlabeled', // Pattern was passed without specifying a type
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
  projects: ProjectNodeMap
): string[] {
  const projectNames = keys(projects);

  const selectedProjects: Set<string> = new Set();
  const excludedProjects: Set<string> = new Set();

  for (const stringPattern of patterns) {
    const pattern = parseStringPattern(stringPattern, projects);

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

    switch (pattern.type) {
      case 'tag': {
        addMatchingProjectsByTag(
          projectNames,
          projects,
          pattern,
          excludedProjects,
          selectedProjects
        );
        continue;
      }
      case 'name': {
        addMatchingProjectsByName(
          projectNames,
          projects,
          pattern,
          excludedProjects,
          selectedProjects
        );
        continue;
      }
      case 'directory': {
        addMatchingProjectsByDirectory(
          projectNames,
          projects,
          pattern,
          excludedProjects,
          selectedProjects
        );
        continue;
      }
      // Same thing as `type:unlabeled`. If no specific type is set,
      // we can waterfall through the different types until we find a match
      default: {
        const size = selectedProjects.size + excludedProjects.size;
        addMatchingProjectsByName(
          projectNames,
          projects,
          pattern,
          excludedProjects,
          selectedProjects
        );
        if (selectedProjects.size + excludedProjects.size > size) {
          // There was some match by name, don't check other types
          continue;
        }
        addMatchingProjectsByDirectory(
          projectNames,
          projects,
          pattern,
          excludedProjects,
          selectedProjects
        );
        if (selectedProjects.size + excludedProjects.size > size) {
          // There was some match by directory, don't check other types
          // Note - this doesn't do anything currently, but preps for future
          // types
          continue;
        }
      }
    }
  }

  for (const project of excludedProjects) {
    selectedProjects.delete(project);
  }

  return Array.from(selectedProjects);
}

function addMatchingProjectsByDirectory(
  projectNames: string[],
  projects: ProjectNodeMap,
  pattern: ProjectPattern,
  excludedProjects: Set<string>,
  selectedProjects: Set<string>
) {
  for (const projectName of projectNames) {
    const root = getItemInMapOrRecord(projects, projectName).data.root;
    if (getMatchingStringsWithCache(pattern.value, [root]).length > 0) {
      (pattern.exclude ? excludedProjects : selectedProjects).add(projectName);
    }
  }
}

function addMatchingProjectsByName(
  projectNames: string[],
  projects: ProjectNodeMap,
  pattern: ProjectPattern,
  excludedProjects: Set<string>,
  selectedProjects: Set<string>
) {
  if (hasKey(projects, pattern.value)) {
    (pattern.exclude ? excludedProjects : selectedProjects).add(pattern.value);
    return;
  }

  if (!globCharacters.some((c) => pattern.value.includes(c))) {
    return;
  }

  const matchedProjectNames = getMatchingStringsWithCache(
    pattern.value,
    projectNames
  );
  for (const projectName of matchedProjectNames) {
    if (pattern.exclude) {
      excludedProjects.add(projectName);
    } else {
      selectedProjects.add(projectName);
    }
  }
}

function addMatchingProjectsByTag(
  projectNames: string[],
  projects: ProjectNodeMap,
  pattern: ProjectPattern,
  excludedProjects: Set<string>,
  selectedProjects: Set<string>
) {
  for (const projectName of projectNames) {
    const tags = getItemInMapOrRecord(projects, projectName).data.tags || [];

    if (tags.includes(pattern.value)) {
      (pattern.exclude ? excludedProjects : selectedProjects).add(projectName);
      continue;
    }

    if (!globCharacters.some((c) => pattern.value.includes(c))) {
      continue;
    }

    if (getMatchingStringsWithCache(pattern.value, tags).length) {
      (pattern.exclude ? excludedProjects : selectedProjects).add(projectName);
    }
  }
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
  projects: ProjectNodeMap
): ProjectPattern {
  const isExclude = pattern.startsWith('!');

  // Support for things like: `!{type}:value`
  if (isExclude) {
    pattern = pattern.substring(1);
  }

  const indexOfFirstPotentialSeparator = pattern.indexOf(':');
  // There is a project that matches directly
  if (hasKey(projects, pattern)) {
    return { type: 'name', value: pattern, exclude: isExclude };
    // The pattern does not contain a label
  } else if (indexOfFirstPotentialSeparator === -1) {
    return { type: 'unlabeled', value: pattern, exclude: isExclude };
    // The pattern may contain a label
  } else {
    const potentialType = pattern.substring(0, indexOfFirstPotentialSeparator);
    return {
      type: isValidPatternType(potentialType) ? potentialType : 'unlabeled',
      value: pattern.substring(indexOfFirstPotentialSeparator + 1),
      exclude: isExclude,
    };
  }
}

function isValidPatternType(type: string): type is ProjectPatternType {
  return validPatternTypes.includes(type as ProjectPatternType);
}

export const getMatchingStringsWithCache = (() => {
  // Map< Pattern, Map< Item, Result >>
  const minimatchCache = new Map<string, Map<string, boolean>>();
  return (pattern: string, items: string[]) => {
    if (!minimatchCache.has(pattern)) {
      minimatchCache.set(pattern, new Map());
    }
    const patternCache = minimatchCache.get(pattern)!;
    let matcher = null;
    return items.filter((item) => {
      let entry = patternCache.get(item);
      if (entry === undefined || entry === null) {
        matcher ??= minimatch.makeRe(pattern);
        entry = item === pattern ? true : matcher.test(item);
        patternCache.set(item, entry);
      }
      return entry;
    });
  };
})();
