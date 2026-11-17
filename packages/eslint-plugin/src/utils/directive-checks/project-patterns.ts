import type { ProjectGraph } from '@nx/devkit';
import {
  findClosestMatches,
  findMatchingProjects,
  transformProjectGraphForProjectMatching,
  unmatchedProjectPatterns,
} from '@nx/devkit/internal';

/**
 * The patterns that select no project under the task hasher's rules, each
 * mapped to a project name to suggest, or undefined.
 */
export function findUnmatchedProjectPatterns(
  patterns: string[],
  projectGraph: ProjectGraph
): Map<string, string | undefined> {
  const unmatched = new Map<string, string | undefined>();
  for (const pattern of unmatchedProjectPatterns(
    transformProjectGraphForProjectMatching(projectGraph),
    patterns
  )) {
    unmatched.set(pattern, suggestProject(pattern, projectGraph));
  }
  return unmatched;
}

/**
 * Suggests a project name only, which the hasher accepts because it matches an
 * exact name before reading any prefix.
 */
function suggestProject(
  pattern: string,
  projectGraph: ProjectGraph
): string | undefined {
  if (pattern.startsWith('tag:') || pattern.startsWith('directory:')) {
    return undefined;
  }
  // The looser TypeScript matcher finds the project a case-insensitive or
  // unscoped name means.
  const looseMatches = findMatchingProjects([pattern], projectGraph.nodes);
  if (looseMatches.length === 1) {
    return looseMatches[0];
  }
  const name = pattern.startsWith('name:')
    ? pattern.slice('name:'.length)
    : pattern;
  return findClosestMatches(name, Object.keys(projectGraph.nodes), 1)[0];
}
