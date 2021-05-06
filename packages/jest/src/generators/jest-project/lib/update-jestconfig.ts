import { JestProjectSchema } from '../schema';
import { addPropertyToJestConfig } from '../../../utils/config/update-config';
import { readProjectConfiguration, Tree } from '@nrwl/devkit';

export function updateJestConfig(host: Tree, options: JestProjectSchema) {
  const project = readProjectConfiguration(host, options.project);
  addPropertyToJestConfig(
    host,
    'jest.config.js',
    'projects',
    `<rootDir>/${project.root}`
  );
}
