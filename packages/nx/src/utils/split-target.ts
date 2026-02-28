import { ProjectGraph, ProjectGraphProjectNode } from '../config/project-graph';

function findMatchingSegments(
  s: string,
  nodes: Record<string, ProjectGraphProjectNode>
): [string, string?, string?] | undefined {
  const projectNames = Object.keys(nodes);
  // return project if matching
  if (projectNames.includes(s)) {
    return [s];
  }
  if (!s.includes(':')) {
    return;
  }
  for (const projectName of projectNames) {
    for (const [targetName, targetConfig] of Object.entries(
      nodes[projectName].data.targets || {}
    )) {
      if (s === `${projectName}:${targetName}`) {
        return [projectName, targetName];
      }
      if (targetConfig.configurations) {
        for (const configurationName of Object.keys(
          targetConfig.configurations
        )) {
          if (s === `${projectName}:${targetName}:${configurationName}`) {
            return [projectName, targetName, configurationName];
          }
        }
      }
    }
  }
}

export function splitTargetFromNodes(
  s: string,
  nodes: Record<string, ProjectGraphProjectNode>
): [project: string, target?: string, configuration?: string] {
  const matchingSegments = findMatchingSegments(s, nodes);
  if (matchingSegments) {
    return matchingSegments;
  }
  if (s.indexOf(':') > 0) {
    let [project, ...segments] = splitByColons(s);
    // if only configuration cannot be matched, try to match project and target
    const configuration = segments[segments.length - 1];
    const rest = s.slice(0, -(configuration.length + 1));
    const matchingSegments = findMatchingSegments(rest, nodes);
    if (matchingSegments && matchingSegments.length === 2) {
      return [...(matchingSegments as [string, string]), configuration];
    }
    // no project-target pair found, do the naive matching
    const validTargets = nodes[project] ? nodes[project].data.targets : {};
    const validTargetNames = new Set(Object.keys(validTargets ?? {}));

    return [project, ...groupJointSegments(segments, validTargetNames)] as [
      string,
      string?,
      string?,
    ];
  }
  // we don't know what to do with the string, return as is
  return [s];
}

export function splitTarget(
  s: string,
  projectGraph: ProjectGraph
): [project: string, target?: string, configuration?: string] {
  return splitTargetFromNodes(s, projectGraph.nodes);
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
