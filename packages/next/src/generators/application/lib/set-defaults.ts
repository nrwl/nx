import { readNxJson, Tree, updateNxJson } from '@nx/devkit';

import { NormalizedSchema } from './normalize-options';

export function setDefaults(host: Tree, options: NormalizedSchema) {
  const nxJson = readNxJson(host);

  nxJson.generators ??= {};
  nxJson.generators['@nx/next'] ??= {};
  nxJson.generators['@nx/next'].application ??= {};
  nxJson.generators['@nx/next'].application.style ??= options.style;
  nxJson.generators['@nx/next'].application.linter ??= options.linter;

  updateNxJson(host, nxJson);
}
