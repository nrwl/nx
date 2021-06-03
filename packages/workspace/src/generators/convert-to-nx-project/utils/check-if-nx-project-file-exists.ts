import { ProjectConfiguration, Tree } from '@nrwl/devkit';
import { getProjectConfigurationPath } from './get-project-configuration-path';

export function checkIfNxProjectFileExists(
  host: Tree,
  project: ProjectConfiguration
) {
  return host.exists(getProjectConfigurationPath(project));
}
