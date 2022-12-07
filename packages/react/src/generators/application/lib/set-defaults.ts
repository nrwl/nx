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

  if (!options.skipDefaultProject && !workspace.defaultProject) {
    workspace.defaultProject = options.projectName;
  }

  workspace.generators = workspace.generators || {};
  workspace.generators['@nrwl/react'] =
    workspace.generators['@nrwl/react'] || {};

  const prev = { ...workspace.generators['@nrwl/react'] };

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
  // Future react libs should use same test runner as the app.
  if (options.unitTestRunner === 'vitest') {
    // Note: We don't set bundler: 'vite' for libraries because that means they are buildable.
    libDefaults.unitTestRunner ??= 'vitest';
  }
  workspace.generators = {
    ...workspace.generators,
    '@nrwl/react': {
      ...prev,
      application: appDefaults,
      component: componentDefaults,
      library: libDefaults,
    },
  };

  updateWorkspaceConfiguration(host, workspace);
}
