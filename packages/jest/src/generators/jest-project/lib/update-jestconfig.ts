import { findRootJestConfig } from '../../../utils/config/find-root-jest-files';
import { JestProjectSchema } from '../schema';
import { addPropertyToJestConfig } from '../../../utils/config/update-config';
import { readProjectConfiguration, Tree } from '@nrwl/devkit';

function isUsingUtilityFunction(host: Tree) {
  const rootConfig = findRootJestConfig(host);
  return (
    rootConfig && host.read(rootConfig).toString().includes('getJestProjects()')
  );
}

export function updateJestConfig(host: Tree, options: JestProjectSchema) {
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
