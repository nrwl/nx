import {
  readWorkspaceConfiguration,
  Tree,
  updateWorkspaceConfiguration,
} from '@nrwl/devkit';
import { NormalizedSchema } from '../schema';

export function setDefaults(host: Tree, options: NormalizedSchema) {
  const workspace = readWorkspaceConfiguration(host);

  workspace.generators = workspace.generators || {};
  workspace.generators['@nrwl/react'] =
    workspace.generators['@nrwl/react'] || {};

  const prev = { ...workspace.generators['@nrwl/react'] };

  const libDefaults = {
    ...prev.library,
    unitTestRunner: prev.library?.unitTestRunner ?? options.unitTestRunner,
  };

  workspace.generators = {
    ...workspace.generators,
    '@nrwl/react': {
      ...prev,
      library: libDefaults,
    },
  };

  updateWorkspaceConfiguration(host, workspace);
}
