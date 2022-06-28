import { findRootJestConfig } from '../../../utils/config/find-root-jest-files';
import { JestProjectSchema } from '../schema';
import { addPropertyToJestConfig } from '../../../utils/config/update-config';
import { readProjectConfiguration, Tree } from '@nrwl/devkit';

function isUsingUtilityFunction(host: Tree) {
  return host
    .read(findRootJestConfig(host))
    .toString()
    .includes('getJestProjects()');
}

export function updateJestConfig(host: Tree, options: JestProjectSchema) {
  if (isUsingUtilityFunction(host)) {
    return;
  }
  const project = readProjectConfiguration(host, options.project);
  addPropertyToJestConfig(
    host,
    findRootJestConfig(host),
    'projects',
    `<rootDir>/$"14.4.0-beta.5"root}`
  );
}
