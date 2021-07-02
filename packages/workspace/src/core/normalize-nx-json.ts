import { NxJsonConfiguration } from '@nrwl/devkit';
import * as minimatch from 'minimatch';

export function normalizeNxJson(
  nxJson: NxJsonConfiguration
): NxJsonConfiguration<string[]> {
  return nxJson.implicitDependencies
    ? {
        ...nxJson,
        implicitDependencies: Object.entries(
          nxJson.implicitDependencies
        ).reduce((acc, [key, val]) => {
          acc[key] = recur(val);
          return acc;

          function recur(v: '*' | string[] | {}): string[] | {} {
            if (typeof v === 'string') {
              return Object.keys(nxJson.projects).filter((project) =>
                minimatch(project, v)
              );
            } else if (Array.isArray(v)) {
              return v;
            } else {
              return Object.keys(v).reduce((xs, x) => {
                xs[x] = recur(v[x]);
                return xs;
              }, {});
            }
          }
        }, {}),
      }
    : (nxJson as NxJsonConfiguration<string[]>);
}
