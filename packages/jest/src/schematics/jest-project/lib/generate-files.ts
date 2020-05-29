import {
  apply,
  filter,
  mergeWith,
  move,
  noop,
  Rule,
  SchematicContext,
  template,
  Tree,
  url,
} from '@angular-devkit/schematics';
import { getProjectConfig, offsetFromRoot } from '@nrwl/workspace';
import { JestProjectSchema } from '../schema';

export function generateFiles(options: JestProjectSchema): Rule {
  return (tree: Tree, _context: SchematicContext): Rule => {
    const projectConfig = getProjectConfig(tree, options.project);

    return mergeWith(
      apply(url('./files'), [
        template({
          tmpl: '',
          ...options,
          transformer: options.babelJest ? 'babel-jest' : 'ts-jest',
          projectRoot: projectConfig.root,
          offsetFromRoot: offsetFromRoot(projectConfig.root),
        }),
        options.setupFile === 'none'
          ? filter((file) => file !== '/src/test-setup.ts')
          : noop(),
        options.babelJest
          ? noop()
          : filter((file) => file != '/babel-jest.config.json'),
        move(projectConfig.root),
      ])
    );
  };
}
