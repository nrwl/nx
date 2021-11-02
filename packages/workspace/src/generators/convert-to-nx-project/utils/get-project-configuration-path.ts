import { ProjectConfiguration } from '@nrwl/devkit';
import { join } from 'path';

export function getProjectConfigurationPath(
  configuration: ProjectConfiguration
) {
  return join(configuration.root, 'project.json');
}
