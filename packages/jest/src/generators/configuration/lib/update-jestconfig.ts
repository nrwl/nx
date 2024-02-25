import { findRootJestConfig } from '../../../utils/config/find-root-jest-files';
import { NormalizedJestProjectSchema } from '../schema';
import { addPropertyToJestConfig } from '../../../utils/config/update-config';
import { readProjectConfiguration, Tree } from '@nx/devkit';

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
