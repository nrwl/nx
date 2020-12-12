import { Rule, SchematicContext } from '@angular-devkit/schematics';
import { Tree } from '@angular-devkit/schematics/src/tree/interface';
import { getWorkspace } from '@nrwl/workspace';
import * as path from 'path';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Schema } from '../schema';
import { getDestination } from './utils';
import { appRootPath } from '@nrwl/workspace/src/utils/app-root';
import { allFilesInDirInHost } from '@nrwl/workspace/src/utils/ast-utils';
import { Path, normalize } from '@angular-devkit/core';

/**
 * Updates relative path to root storybook config for `main.js` & `webpack.config.js`
 *
 * @param schema The options provided to the schematic
 */
export function updateStorybookConfig(schema: Schema): Rule {
  return (tree: Tree, _context: SchematicContext): Observable<Tree> => {
    return from(getWorkspace(tree)).pipe(
      map((workspace) => {
        const project = workspace.projects.get(schema.projectName);
        const destination = getDestination(schema, workspace, tree);

        const oldRelativeRoot = path
          .relative(
            path.join(appRootPath, `${project.root}/.storybook`),
            appRootPath
          )
          .split(path.sep)
          .join('/');
        const newRelativeRoot = path
          .relative(
            path.join(appRootPath, `${destination}/.storybook`),
            appRootPath
          )
          .split(path.sep)
          .join('/');

        const storybookDir = path.join(destination, '.storybook');

        if (!storybookDir) {
          return tree;
        }

        // Replace relative import path to root storybook folder for each file under project storybook
        tree.getDir(storybookDir).visit((file) => {
          const oldContent = tree.read(file).toString('utf-8');
          const newContent = oldContent.replace(
            oldRelativeRoot,
            newRelativeRoot
          );

          tree.overwrite(file, newContent);
        });

        return tree;
      })
    );
  };
}
