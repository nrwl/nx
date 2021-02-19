import {
  readWorkspaceConfiguration,
  Tree,
  updateWorkspaceConfiguration,
} from '@nrwl/devkit';

import { NormalizedSchema } from './normalize-options';

export function setDefaults(host: Tree, options: NormalizedSchema) {
  const workspace = readWorkspaceConfiguration(host);

  if (!workspace.defaultProject) {
    workspace.defaultProject = options.projectName;
  }

  workspace.generators = workspace.generators || {};
  workspace.generators['@nrwl/next'] = workspace.generators['@nrwl/next'] || {};
  const prev = workspace.generators['@nrwl/next'];

  workspace.generators = {
    ...workspace.generators,
    '@nrwl/next': {
      ...prev,
      application: {
        style: options.style,
        linter: options.linter,
        ...prev.application,
      },
    },
  };
  updateWorkspaceConfiguration(host, workspace);
}
