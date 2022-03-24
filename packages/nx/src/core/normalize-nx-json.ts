/**
 * Normalize nx json by replacing wildcard `*` implicit dependencies
 * to an array of all project names
 * @param {NxJsonConfiguration} nxJson
 * @returns {NxJsonConfiguration<string[]>}
 */
import { NxJsonConfiguration } from 'nx/src/shared/nx';

export function normalizeNxJson(
  nxJson: NxJsonConfiguration,
  projects: string[]
): NxJsonConfiguration<string[]> {
  return nxJson.implicitDependencies
    ? {
        ...nxJson,
        implicitDependencies: Object.entries(
          nxJson.implicitDependencies
        ).reduce((acc, [key, val]) => {
          acc[key] = recur(projects, val);
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
function recur(projects: string[], v: '*' | string[] | {}): string[] | {} {
  if (v === '*') {
    return projects;
  } else if (Array.isArray(v)) {
    return v;
  } else {
    return Object.keys(v).reduce((acc, key) => {
      acc[key] = recur(projects, v[key]);
      return acc;
    }, {});
  }
}
