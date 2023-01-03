import { readNxJson, Tree, updateNxJson } from '@nrwl/devkit';

import { NormalizedSchema } from './normalize-options';

export function setDefaults(host: Tree, options: NormalizedSchema) {
  const nxJson = readNxJson(host);

  nxJson.generators = nxJson.generators || {};
  nxJson.generators['@nrwl/next'] = nxJson.generators['@nrwl/next'] || {};
  const prev = nxJson.generators['@nrwl/next'];

  nxJson.generators = {
    ...nxJson.generators,
    '@nrwl/next': {
      ...prev,
      application: {
        style: options.style,
        linter: options.linter,
        ...prev.application,
      },
    },
  };
  updateNxJson(host, nxJson);
}
