import { minimatch } from 'minimatch';
import type { ProjectGraphProjectNode } from '../config/project-graph';

const validPatternTypes = [
  'name', // Pattern is based on the project's name
  'tag', // Pattern is based on the project's tags
  'directory', // Pattern is based on the project's root directory
  'unlabeled', // Pattern was passed without specifying a type
] as const;
type ProjectPatternType = (typeof validPatternTypes)[number];

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
  projects: Record<string, ProjectGraphProjectNode>
): string[] {
  if (!patterns.length || patterns.filter((p) => p.length).length === 0) {
    return []; // Short circuit if called with no patterns
  }

  const projectNames = Object.keys(projects);

  const matchedProjects: Set<string> = new Set();

  // If the first pattern is an exclude pattern,
  // we add a wildcard pattern at the first to select
  // all projects, except the ones that match the exclude pattern.
  // e.g. ['!tag:someTag', 'project2'] will match all projects except
  // the ones with the tag 'someTag', and also match the project 'project2',
  // regardless of its tags.
  if (isExcludePattern(patterns[0])) {
    patterns.unshift('*');
  }

  for (const stringPattern of patterns) {
    if (!stringPattern.length) {
      continue;
    }

    const pattern = parseStringPattern(stringPattern, projects);

    // Handle wildcard with short-circuit, as its a common case with potentially
    // large project sets and we can avoid the more expensive glob matching.
    if (pattern.value === '*') {
      for (const projectName of projectNames) {
        if (pattern.exclude) {
          matchedProjects.delete(projectName);
        } else {
          matchedProjects.add(projectName);
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
          matchedProjects
        );
        continue;
      }
      case 'name': {
        addMatchingProjectsByName(
          projectNames,
          projects,
          pattern,
          matchedProjects
        );
        continue;
      }
      case 'directory': {
        addMatchingProjectsByDirectory(
          projectNames,
          projects,
          pattern,
          matchedProjects
        );
        continue;
      }
      // Same thing as `type:unlabeled`. If no specific type is set,
      // we can waterfall through the different types until we find a match
      default: {
        // The size of the selected and excluded projects set, before we
        // start updating it with this pattern. If the size changes, we
        // know we found a match and can skip the other types.
        const originalSize = matchedProjects.size;
        addMatchingProjectsByName(
          projectNames,
          projects,
          pattern,
          matchedProjects
        );
        if (matchedProjects.size !== originalSize) {
          // There was some match by name, don't check other types
          continue;
        }
        addMatchingProjectsByDirectory(
          projectNames,
          projects,
          pattern,
          matchedProjects
        );
        if (matchedProjects.size !== originalSize) {
          // There was some match by directory, don't check other types
          // Note - this doesn't do anything currently, but preps for future
          // types
          continue;
        }
      }
    }
  }

  return Array.from(matchedProjects);
}

function addMatchingProjectsByDirectory(
  projectNames: string[],
  projects: Record<string, ProjectGraphProjectNode>,
  pattern: ProjectPattern,
  matchedProjects: Set<string>
) {
  for (const projectName of projectNames) {
    const root = projects[projectName].data.root;
    if (getMatchingStringsWithCache(pattern.value, [root]).length > 0) {
      if (pattern.exclude) {
        matchedProjects.delete(projectName);
      } else {
        matchedProjects.add(projectName);
      }
    }
  }
}

function addMatchingProjectsByName(
  projectNames: string[],
  projects: Record<string, ProjectGraphProjectNode>,
  pattern: ProjectPattern,
  matchedProjects: Set<string>
) {
  if (projects[pattern.value]) {
    if (pattern.exclude) {
      matchedProjects.delete(pattern.value);
    } else {
      matchedProjects.add(pattern.value);
    }
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
      matchedProjects.delete(projectName);
    } else {
      matchedProjects.add(projectName);
    }
  }
}

function addMatchingProjectsByTag(
  projectNames: string[],
  projects: Record<string, ProjectGraphProjectNode>,
  pattern: ProjectPattern,
  matchedProjects: Set<string>
) {
  for (const projectName of projectNames) {
    const tags = projects[projectName].data.tags || [];

    if (tags.includes(pattern.value)) {
      if (pattern.exclude) {
        matchedProjects.delete(projectName);
      } else {
        matchedProjects.add(projectName);
      }
      continue;
    }

    if (!globCharacters.some((c) => pattern.value.includes(c))) {
      continue;
    }

    if (getMatchingStringsWithCache(pattern.value, tags).length) {
      if (pattern.exclude) {
        matchedProjects.delete(projectName);
      } else {
        matchedProjects.add(projectName);
      }
    }
  }
}

function isExcludePattern(pattern: string): boolean {
  return pattern.startsWith('!');
}

function parseStringPattern(
  pattern: string,
  projects: Record<string, ProjectGraphProjectNode>
): ProjectPattern {
  const isExclude = isExcludePattern(pattern);

  // Support for things like: `!{type}:value`
  if (isExclude) {
    pattern = pattern.substring(1);
  }

  const indexOfFirstPotentialSeparator = pattern.indexOf(':');
  // There is a project that matches directly
  if (projects[pattern]) {
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
  const regexCache = new Map<string, RegExp>();
  return (pattern: string, items: string[]) => {
    if (!minimatchCache.has(pattern)) {
      minimatchCache.set(pattern, new Map());
    }
    const patternCache = minimatchCache.get(pattern)!;
    if (!regexCache.has(pattern)) {
      const regex = minimatch.makeRe(pattern, { dot: true });
      if (regex) {
        regexCache.set(pattern, regex);
      } else {
        throw new Error('Invalid glob pattern ' + pattern);
      }
    }
    const matcher = regexCache.get(pattern);
    return items.filter((item) => {
      let entry = patternCache.get(item);
      if (entry === undefined || entry === null) {
        entry = item === pattern ? true : matcher.test(item);
        patternCache.set(item, entry);
      }
      return entry;
    });
  };
})();
