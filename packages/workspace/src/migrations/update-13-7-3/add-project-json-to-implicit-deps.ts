import {
  readWorkspaceConfiguration,
  Tree,
  updateWorkspaceConfiguration,
} from '@nrwl/devkit';

export function addProjectJsonToImplicitDeps(host: Tree) {
  const workspaceConfig = readWorkspaceConfiguration(host);
  if (!workspaceConfig.extends) {
    const appsDir = workspaceConfig.workspaceLayout?.appsDir || 'apps';
    const libsDir = workspaceConfig.workspaceLayout?.libsDir || 'libs';
    // make sure dependencies exist
    workspaceConfig.implicitDependencies =
      workspaceConfig.implicitDependencies || {};
    // set implicit dependencies
    workspaceConfig.implicitDependencies[`${appsDir}/**/project.json`] =
      workspaceConfig.implicitDependencies[`${appsDir}/**/project.json`] || {
        tags: '*',
      };
    workspaceConfig.implicitDependencies[`${libsDir}/**/project.json`] =
      workspaceConfig.implicitDependencies[`${libsDir}/**/project.json`] || {
        tags: '*',
      };
  }
  updateWorkspaceConfiguration(host, workspaceConfig);
}

export default addProjectJsonToImplicitDeps;
