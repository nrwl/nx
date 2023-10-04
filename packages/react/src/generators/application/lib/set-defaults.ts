import { readNxJson, Tree, updateNxJson } from '@nx/devkit';
import { NormalizedSchema } from '../schema';

export function setDefaults(host: Tree, options: NormalizedSchema) {
  if (options.skipNxJson) {
    return;
  }

  const nxJson = readNxJson(host);

  if (options.rootProject) {
    nxJson.defaultProject = options.projectName;
  }

  nxJson.generators = nxJson.generators || {};
  nxJson.generators['@nx/react'] = nxJson.generators['@nx/react'] || {};

  const prev = { ...nxJson.generators['@nx/react'] };

  const appDefaults = {
    style: options.style,
    linter: options.linter,
    bundler: options.bundler,
    ...prev.application,
  };
  const componentDefaults = {
    style: options.style,
    ...prev.component,
  };
  const libDefaults = {
    style: options.style,
    linter: options.linter,
    ...prev.library,
  };

  nxJson.generators = {
    ...nxJson.generators,
    '@nx/react': {
      ...prev,
      application: appDefaults,
      component: componentDefaults,
      library: libDefaults,
    },
  };

  updateNxJson(host, nxJson);
}
