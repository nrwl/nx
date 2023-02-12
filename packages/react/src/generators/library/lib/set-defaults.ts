import { readNxJson, Tree, updateNxJson } from '@nrwl/devkit';
import { NormalizedSchema } from '../schema';

export function setDefaults(host: Tree, options: NormalizedSchema) {
  const nxJson = readNxJson(host);

  nxJson.generators = nxJson.generators || {};
  nxJson.generators['@nrwl/react'] = nxJson.generators['@nrwl/react'] || {};

  const prev = { ...nxJson.generators['@nrwl/react'] };

  const libDefaults = {
    ...prev.library,
    unitTestRunner: prev.library?.unitTestRunner ?? options.unitTestRunner,
  };

  nxJson.generators = {
    ...nxJson.generators,
    '@nrwl/react': {
      ...prev,
      library: libDefaults,
    },
  };

  updateNxJson(host, nxJson);
}
