import type { Tree } from '@nrwl/devkit';
import { readNxJson, updateNxJson } from '@nrwl/devkit';

export function setApplicationStrictDefault(host: Tree, strict: boolean) {
  const nxJson = readNxJson(host);

  nxJson.generators = nxJson.generators || {};
  nxJson.generators['@nrwl/angular:application'] =
    nxJson.generators['@nrwl/angular:application'] || {};
  nxJson.generators['@nrwl/angular:application'].strict =
    nxJson.generators['@nrwl/angular:application'].strict ?? strict;

  updateNxJson(host, nxJson);
}
