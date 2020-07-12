import { Rule, SchematicContext } from '@angular-devkit/schematics';
import { Tree } from '@angular-devkit/schematics/src/tree/interface';
import { getWorkspace } from '@nrwl/workspace';
import * as path from 'path';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Schema } from '../schema';
import { getDestination, getNewProjectName } from './utils';

/**
 * Updates the project name and coverage folder in the jest.config.js if it exists
 *
 * (assume relative paths have been updated previously)
 *
 * @param schema The options provided to the schematic
 */
export function updateJestConfig(schema: Schema): Rule {
  return (tree: Tree, _context: SchematicContext): Observable<Tree> => {
    return from(getWorkspace(tree)).pipe(
      map((workspace) => {
        const project = workspace.projects.get(schema.projectName);
        const destination = getDestination(schema, workspace, tree);
        const newProjectName = getNewProjectName(schema.destination);

        const jestConfigPath = path.join(destination, 'jest.config.js');

        if (!tree.exists(jestConfigPath)) {
          // nothing to do
          return tree;
        }

        const oldContent = tree.read(jestConfigPath).toString('utf-8');

        const findName = new RegExp(`'${schema.projectName}'`, 'g');
        const findDir = new RegExp(project.root, 'g');

        const newContent = oldContent
          .replace(findName, `'${newProjectName}'`)
          .replace(findDir, destination);
        tree.overwrite(jestConfigPath, newContent);

        return tree;
      })
    );
  };
}
