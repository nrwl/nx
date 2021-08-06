import { NxJsonConfiguration, WorkspaceJsonConfiguration } from '@nrwl/devkit';

/**
 * Normalize nx json by replacing wildcard `*` implicit dependencies
 * to an array of all project names
 * @param {NxJsonConfiguration} nxJson
 * @returns {NxJsonConfiguration<string[]>}
 */
export function normalizeNxJson(
  nxJson: NxJsonConfiguration,
  workspaceJson: WorkspaceJsonConfiguration
): NxJsonConfiguration<string[]> {
  return nxJson.implicitDependencies
    ? {
        ...nxJson,
        implicitDependencies: Object.entries(
          nxJson.implicitDependencies
        ).reduce((acc, [key, val]) => {
          acc[key] = recur(workspaceJson, val);
          return acc;
        }, {}),
      }
    : (nxJson as NxJsonConfiguration<string[]>);
}

/**
 * Map recursively wildcard `*` to project names
 * @param {NxJsonConfiguration} nxJson
 * @param {'*' | string[] | {}} v
 * @returns {string[] | {}}
 */
function recur(
  workspaceJson: WorkspaceJsonConfiguration,
  v: '*' | string[] | {}
): string[] | {} {
  if (v === '*') {
    return Object.keys(workspaceJson.projects);
  } else if (Array.isArray(v)) {
    return v;
  } else {
    return Object.keys(v).reduce((acc, key) => {
      acc[key] = recur(workspaceJson, v[key]);
      return acc;
    }, {});
  }
}
