import { ProjectGraph } from '../config/project-graph';
import { ProjectConfiguration } from '../config/workspace-json-project-json';

export function splitTarget(
  s: string,
  projectGraph: ProjectGraph<ProjectConfiguration>
): [project: string, target?: string, configuration?: string] {
  const [project, ...segments] = splitByColons(s);
  const validTargets = new Set(
    Object.keys(projectGraph.nodes[project].data.targets)
  );

  for (
    let endingSegmentIdx = segments.length;
    endingSegmentIdx > 0;
    endingSegmentIdx--
  ) {
    const potentialTargetName = segments.slice(0, endingSegmentIdx).join(':');
    if (validTargets.has(potentialTargetName)) {
      const configurationName =
        endingSegmentIdx < segments.length
          ? segments.slice(endingSegmentIdx).join(':')
          : null;
      return configurationName
        ? [project, potentialTargetName, configurationName]
        : [project, potentialTargetName];
    }
  }

  return [project];
}

function splitByColons(s: string) {
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
