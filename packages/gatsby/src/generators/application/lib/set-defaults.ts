import {
  Tree,
  readWorkspaceConfiguration,
  updateWorkspaceConfiguration,
} from '@nrwl/devkit';

import { NormalizedSchema } from './normalize-options';

export function setDefaults(host: Tree, options: NormalizedSchema) {
  const workspace = readWorkspaceConfiguration(host);

  if (!workspace.defaultProject) {
    workspace.defaultProject = options.projectName;
  }

  workspace.generators = workspace.generators || {};
  workspace.generators['@nrwl/gatsby'] =
    workspace.generators['@nrwl/gatsby'] || {};
  const prev = workspace.generators['@nrwl/gatsby'];

  workspace.generators = {
    ...workspace.generators,
    '@nrwl/gatsby': {
      ...prev,
      application: {
        style: options.style,
        ...prev.application,
      },
    },
  };

  updateWorkspaceConfiguration(host, workspace);
}
