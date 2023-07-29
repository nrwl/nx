import { ProjectGraph } from '../config/project-graph';
import { ProjectConfiguration } from '../config/workspace-json-project-json';

export function splitTarget(
  s: string,
  projectGraph: ProjectGraph
): [project: string, target?: string, configuration?: string] {
  let [project, ...segments] = splitByColons(s);
  const validTargets = projectGraph.nodes[project]
    ? projectGraph.nodes[project].data.targets
    : {};
  const validTargetNames = new Set(Object.keys(validTargets ?? {}));

  return [project, ...groupJointSegments(segments, validTargetNames)] as [
    string,
    string?,
    string?
  ];
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
