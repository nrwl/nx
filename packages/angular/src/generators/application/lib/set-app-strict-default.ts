import type { Tree } from '@nx/devkit';
import { readNxJson, updateNxJson } from '@nx/devkit';

export function setApplicationStrictDefault(host: Tree, strict: boolean) {
  const nxJson = readNxJson(host);

  nxJson.generators = nxJson.generators || {};
  nxJson.generators['@nx/angular:application'] =
    nxJson.generators['@nx/angular:application'] || {};
  nxJson.generators['@nx/angular:application'].strict =
    nxJson.generators['@nx/angular:application'].strict ?? strict;

  updateNxJson(host, nxJson);
}
