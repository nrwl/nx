import { readNxJson, Tree, updateNxJson } from '@nx/devkit';
import { NormalizedSchema } from '../schema';

export function setDefaults(host: Tree, options: NormalizedSchema) {
  const nxJson = readNxJson(host);

  nxJson.generators = nxJson.generators || {};
  nxJson.generators['@nx/react'] = nxJson.generators['@nx/react'] || {};

  const prev = { ...nxJson.generators['@nx/react'] };

  const libDefaults = {
    ...prev.library,
    unitTestRunner: prev.library?.unitTestRunner ?? options.unitTestRunner,
  };

  nxJson.generators = {
    ...nxJson.generators,
    '@nx/react': {
      ...prev,
      library: libDefaults,
    },
  };

  updateNxJson(host, nxJson);
}
