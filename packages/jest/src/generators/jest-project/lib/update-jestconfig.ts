import { JestProjectSchema } from '../schema';
import { addPropertyToJestConfig } from '../../../utils/config/update-config';
import { readProjectConfiguration, Tree } from '@nrwl/devkit';

function usingUtilityFunction(host: Tree) {
  // TODO: too naive implementation?
  return host.read('jest.config.js').toString().includes('getJestProjects()');
}

export function updateJestConfig(host: Tree, options: JestProjectSchema) {
  if (usingUtilityFunction(host)) {
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
