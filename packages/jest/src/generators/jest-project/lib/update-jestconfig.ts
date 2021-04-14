import { JestProjectSchema } from '../schema';
import { addPropertyToJestConfig } from '../../../utils/config/update-config';
import { readProjectConfiguration, Tree } from '@nrwl/devkit';
import { parse } from '@babel/parser';

/**
 * Will parse a single-statement `jest.config.js` file to see if the `projects`
 * property exists on the exported config object.
 *
 * Expects a single assignment statement to an Object literal.
 */
function hasProjectsProperty(tree: Tree) {
  const ast = parse(tree.read('jest.config.js').toString());
  return !!(ast.program.body[0] as any).expression.right.properties.find(
    (x) => x.key.name === 'projects'
  );
}

export function updateJestConfig(host: Tree, options: JestProjectSchema) {
  const project = readProjectConfiguration(host, options.project);
  if (!hasProjectsProperty(host)) {
    return;
  }
  addPropertyToJestConfig(
    host,
    'jest.config.js',
    'projects',
    `<rootDir>/${project.root}`
  );
}
