import { JestProjectSchema } from '../schema';
import { addPropertyToJestConfig } from '../../../utils/config/update-config';
import { readProjectConfiguration, Tree } from '@nrwl/devkit';

function isUsingUtilityFunction(host: Tree) {
  return host.read('jest.config.js').toString().includes('getJestProjects()');
}

export function updateJestConfig(host: Tree, options: JestProjectSchema) {
  if (isUsingUtilityFunction(host)) {
    return;
  }
  const project = readProjectConfiguration(host, options.project);
  addPropertyToJestConfig(
    host,
    'jest.config.js',
    'projects',
    `<rootDir>/${project.root}`
  );
}
