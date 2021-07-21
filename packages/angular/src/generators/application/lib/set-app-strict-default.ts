import type { Tree } from '@nrwl/devkit';

import {
  readWorkspaceConfiguration,
  updateWorkspaceConfiguration,
} from '@nrwl/devkit';

export function setApplicationStrictDefault(host: Tree, strict: boolean) {
  const workspaceConfig = readWorkspaceConfiguration(host);

  workspaceConfig.generators = workspaceConfig.generators || {};
  workspaceConfig.generators['@nrwl/angular:application'] =
    workspaceConfig.generators['@nrwl/angular:application'] || {};
  workspaceConfig.generators['@nrwl/angular:application'].strict =
    workspaceConfig.generators['@nrwl/angular:application'].strict ?? strict;

  updateWorkspaceConfiguration(host, workspaceConfig);
}
