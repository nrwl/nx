import { ProjectGraph, ProjectGraphProjectNode } from '../config/project-graph';
import { output } from '../utils/output';

export interface SplitTargetOptions {
  silent?: boolean;
  currentProject?: string;
}

type TargetTuple = [string, string?, string?];

/**
 * Collects all valid [project, target?, config?] interpretations of a
 * colon-delimited string by iterating over the *segments* of the string
 * (O(k²) where k = number of segments) rather than over every project in the
 * graph.
 *
 * When `currentProject` is provided, bare-target interpretations (the string
 * is `target` or `target:config` on that project) are also collected.
 */
function findAllMatchingSegments(
  segments: string[],
  nodes: Record<string, ProjectGraphProjectNode>,
  currentProject?: string
): TargetTuple[] {
  const matches: TargetTuple[] = [];

  // --- Bare-target matches (currentProject context) ---
  if (currentProject && nodes[currentProject]) {
    const targets = nodes[currentProject].data.targets || {};
    for (let j = 1; j <= segments.length; j++) {
      const candidateTarget = segments.slice(0, j).join(':');
      if (!(candidateTarget in targets)) {
        continue;
      }
      const configSegments = segments.slice(j);
      if (configSegments.length === 0) {
        matches.push([currentProject, candidateTarget]);
      } else {
        const candidateConfig = configSegments.join(':');
        const configurations = targets[candidateTarget]?.configurations;
        if (configurations && candidateConfig in configurations) {
          matches.push([currentProject, candidateTarget, candidateConfig]);
        }
      }
    }
  }

  // --- Project-based matches ---
  for (let i = 1; i <= segments.length; i++) {
    const candidateProject = segments.slice(0, i).join(':');
    if (!nodes[candidateProject]) {
      continue;
    }

    const remaining = segments.slice(i);
    if (remaining.length === 0) {
      matches.push([candidateProject]);
      continue;
    }

    const targets = nodes[candidateProject].data.targets || {};
    for (let j = 1; j <= remaining.length; j++) {
      const candidateTarget = remaining.slice(0, j).join(':');
      if (!(candidateTarget in targets)) {
        continue;
      }
      const configSegments = remaining.slice(j);
      if (configSegments.length === 0) {
        matches.push([candidateProject, candidateTarget]);
      } else {
        const candidateConfig = configSegments.join(':');
        const configurations = targets[candidateTarget]?.configurations;
        if (configurations && candidateConfig in configurations) {
          matches.push([candidateProject, candidateTarget, candidateConfig]);
        }
      }
    }
  }

  return matches;
}

/**
 * Deterministic precedence sort for ambiguous target matches.
 *
 * 1. Bare-target matches (currentProject) rank highest — indicated by the
 *    match's project equalling currentProject.
 * 2. Longest (most-specific) project name.
 * 3. Longest target name.
 * 4. Longest configuration name.
 */
function sortMatchesByPrecedence(
  matches: TargetTuple[],
  currentProject?: string
): TargetTuple[] {
  return matches.slice().sort((a, b) => {
    // Bare-target matches (currentProject) rank highest
    const aIsBare = currentProject && a[0] === currentProject ? 1 : 0;
    const bIsBare = currentProject && b[0] === currentProject ? 1 : 0;
    if (aIsBare !== bIsBare) return bIsBare - aIsBare;

    // Longest project name
    if (a[0].length !== b[0].length) return b[0].length - a[0].length;

    // Longest target name
    const aTarget = a[1] ?? '';
    const bTarget = b[1] ?? '';
    if (aTarget.length !== bTarget.length)
      return bTarget.length - aTarget.length;

    // Longest configuration name
    const aConfig = a[2] ?? '';
    const bConfig = b[2] ?? '';
    return bConfig.length - aConfig.length;
  });
}

function formatMatch(match: TargetTuple): string {
  return match.filter(Boolean).join(':');
}

export function splitTargetFromNodes(
  s: string,
  nodes: Record<string, ProjectGraphProjectNode>,
  options?: SplitTargetOptions
): [project: string, target?: string, configuration?: string] {
  const silent = options?.silent ?? false;
  const currentProject = options?.currentProject;

  const segments = splitByColons(s);

  const matches = findAllMatchingSegments(segments, nodes, currentProject);

  if (matches.length > 0) {
    const sorted = sortMatchesByPrecedence(matches, currentProject);

    if (sorted.length > 1 && !silent) {
      output.warn({
        title: `Ambiguous target specifier "${s}"`,
        bodyLines: [
          `This string can be interpreted in multiple ways:`,
          ...sorted.map(
            (m, i) =>
              `  ${i === 0 ? '→' : ' '} ${formatMatch(m)}${
                i === 0 ? ' (selected)' : ''
              }`
          ),
          ``,
          `The most specific match was selected. To avoid ambiguity, use a unique target specifier.`,
        ],
      });
    }

    return sorted[0];
  }

  // --- Fallback: no exact match found in the graph ---
  let colonIndex = s.indexOf(':');
  if (colonIndex === 0) {
    // first colon can't be at the beginning of the string, try to find the next one
    colonIndex = s.indexOf(':', 1);
  }
  if (colonIndex > 0) {
    let [project, ...remainingSegments] = segments;
    // splitByColons splits on every ':', so a leading colon (e.g. ":pkg:build")
    // produces an empty first element. Greedily absorb segments to reconstruct
    // the longest known colon-prefixed project name (e.g. ":utils:common").
    if (project === '' && remainingSegments.length > 0) {
      let absorbed = 1; // absorb at least one segment
      for (let k = remainingSegments.length - 1; k >= 1; k--) {
        const candidate = ':' + remainingSegments.slice(0, k).join(':');
        if (nodes[candidate]) {
          absorbed = k;
          break;
        }
      }
      project = ':' + remainingSegments.slice(0, absorbed).join(':');
      remainingSegments = remainingSegments.slice(absorbed);
    }
    // if only configuration cannot be matched, try to match project and target
    const configuration = remainingSegments[remainingSegments.length - 1];
    const rest = s.slice(0, -(configuration.length + 1));
    const restSegments = splitByColons(rest);
    const restMatches = findAllMatchingSegments(
      restSegments,
      nodes,
      currentProject
    );
    if (restMatches.length > 0) {
      const sorted = sortMatchesByPrecedence(restMatches, currentProject);
      if (sorted[0].length === 2) {
        return [...(sorted[0] as [string, string]), configuration];
      }
    }
    // no project-target pair found, do the naive matching
    const validTargets = nodes[project] ? nodes[project].data.targets : {};
    const validTargetNames = new Set(Object.keys(validTargets ?? {}));

    return [
      project,
      ...groupJointSegments(remainingSegments, validTargetNames),
    ] as [string, string?, string?];
  }
  // we don't know what to do with the string, return as is
  return [s];
}

export function splitTarget(
  s: string,
  projectGraph: ProjectGraph,
  options?: SplitTargetOptions
): [project: string, target?: string, configuration?: string] {
  return splitTargetFromNodes(s, projectGraph.nodes, options);
}

function groupJointSegments(segments: string[], validTargetNames: Set<string>) {
  for (
    let endingSegmentIdx = segments.length;
    endingSegmentIdx > 0;
    endingSegmentIdx--
  ) {
    const potentialTargetName = segments.slice(0, endingSegmentIdx).join(':');
    if (validTargetNames.has(potentialTargetName)) {
      const configurationName =
        endingSegmentIdx < segments.length
          ? segments.slice(endingSegmentIdx).join(':')
          : null;
      return configurationName
        ? [potentialTargetName, configurationName]
        : [potentialTargetName];
    }
  }
  // If we can't find a segment match, keep older behaviour
  return segments;
}

export function splitByColons(s: string) {
  const parts = [] as string[];
  let currentPart = '';
  for (let i = 0; i < s.length; ++i) {
    if (s[i] === ':') {
      parts.push(currentPart);
      currentPart = '';
    } else if (s[i] === '"') {
      i++;
      for (; i < s.length && s[i] != '"'; ++i) {
        currentPart += s[i];
      }
    } else {
      currentPart += s[i];
    }
  }
  parts.push(currentPart);
  return parts as [string, ...string[]];
}
