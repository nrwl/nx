import {
  readWorkspaceConfiguration,
  Tree,
  updateWorkspaceConfiguration,
} from '@nrwl/devkit';
import { NormalizedSchema } from '../schema';

export function setDefaults(host: Tree, options: NormalizedSchema) {
  if (options.skipWorkspaceJson) {
    return;
  }

  const workspace = readWorkspaceConfiguration(host);

  if (!workspace.defaultProject) {
    workspace.defaultProject = options.projectName;
  }

  workspace.generators = workspace.generators || {};
  workspace.generators['@nrwl/react'] =
    workspace.generators['@nrwl/react'] || {};

  const prev = { ...workspace.generators['@nrwl/react'] };

  workspace.generators = {
    ...workspace.generators,
    '@nrwl/react': {
      ...prev,
      application: {
        style: options.style,
        linter: options.linter,
        ...prev.application,
      },
      component: {
        style: options.style,
        ...prev.component,
      },
      library: {
        style: options.style,
        linter: options.linter,
        ...prev.library,
      },
    },
  };

  updateWorkspaceConfiguration(host, workspace);
}
