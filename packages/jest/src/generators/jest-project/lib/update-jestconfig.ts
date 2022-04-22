import { JestProjectSchema } from '../schema';
import { addPropertyToJestConfig } from '../../../utils/config/update-config';
import { readProjectConfiguration, Tree } from '@nrwl/devkit';

function isUsingUtilityFunction(host: Tree, js = false) {
  return host
    .read(`jest.config.${js ? 'js' : 'ts'}`)
    .toString()
    .includes('getJestProjects()');
}

export function updateJestConfig(host: Tree, options: JestProjectSchema) {
  if (isUsingUtilityFunction(host, options.js)) {
    return;
  }
  const project = readProjectConfiguration(host, options.project);
  addPropertyToJestConfig(
    host,
    `jest.config.${options.js ? 'js' : 'ts'}`,
    'projects',
    `<rootDir>/${project.root}`
  );
}
