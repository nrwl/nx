import { NxJson } from './shared-interfaces';

export function normalizeNxJson(nxJson: NxJson): NxJson<string[]> {
  return nxJson.implicitDependencies
    ? {
        ...nxJson,
        implicitDependencies: Object.entries(
          nxJson.implicitDependencies
        ).reduce((acc, [key, val]) => {
          acc[key] = recur(val);
          return acc;

          function recur(v: '*' | string[] | {}): string[] | {} {
            if (v === '*') {
              return Object.keys(nxJson.projects);
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
    : (nxJson as NxJson<string[]>);
}
