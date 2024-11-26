import { readProjectConfiguration, type Tree } from '@nx/devkit';
import { findRootJestConfig } from '../../../utils/config/config-file';
import { addPropertyToJestConfig } from '../../../utils/config/update-config';
import type { NormalizedJestProjectSchema } from '../schema';

function isUsingUtilityFunction(host: Tree) {
  const rootConfig = findRootJestConfig(host);
  if (!rootConfig) {
    return false;
  }

  const rootConfigContent = host.read(rootConfig, 'utf-8');

  return (
    rootConfigContent.includes('getJestProjects()') ||
    rootConfigContent.includes('getJestProjectsAsync()')
  );
}

export function updateJestConfig(
  host: Tree,
  options: NormalizedJestProjectSchema
) {
  if (isUsingUtilityFunction(host)) {
    return;
  }
  const project = readProjectConfiguration(host, options.project);
  const rootConfig = findRootJestConfig(host);
  if (rootConfig) {
    addPropertyToJestConfig(
      host,
      findRootJestConfig(host),
      'projects',
      `<rootDir>/${project.root}`
    );
  }
}
