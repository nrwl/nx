import { ProjectGraph } from '../config/project-graph';

let runCommandsCache: Map<string, [string, string, string?]>;

function getCommandCache(projectGraph: ProjectGraph) {
  if (runCommandsCache) {
    return runCommandsCache;
  }
  runCommandsCache = new Map<string, [string, string, string?]>();
  for (const [projectName, projectNode] of Object.entries(projectGraph.nodes)) {
    for (const [targetName, targetConfig] of Object.entries(
      projectNode.data.targets || {}
    )) {
      // TODO (miro): consider duplicates, otherwise next one overrides it
      runCommandsCache.set(`${projectName}:${targetName}`, [
        projectName,
        targetName,
      ]);
      if (targetConfig.configurations) {
        for (const configurationName of Object.keys(
          targetConfig.configurations
        )) {
          runCommandsCache.set(
            `${projectName}:${targetName}:${configurationName}`,
            [projectName, targetName, configurationName]
          );
        }
      }
    }
  }

  return runCommandsCache;
}

export function splitTarget(
  s: string,
  projectGraph: ProjectGraph
): [project: string, target?: string, configuration?: string] {
  const cache = getCommandCache(projectGraph);
  if (cache.has(s)) {
    return cache.get(s);
  }
  // if only configuration cannot be matched, try to match project and target
  if (s.includes(':')) {
    const configuration = s.split(':').pop();
    const rest = s.slice(0, -(configuration.length + 1));
    if (cache.has(rest) && cache.get(rest).length === 2) {
      return [...(cache.get(rest) as [string, string]), configuration];
    }
  }
  // TODO (miro): consider duplicates, otherwise next one overrides it
  // no project-target pair found, return the original string
  return [s];
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
