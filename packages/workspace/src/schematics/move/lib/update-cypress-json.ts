import { Rule, SchematicContext } from '@angular-devkit/schematics';
import { Tree } from '@angular-devkit/schematics/src/tree/interface';
import { getWorkspace } from '@nrwl/workspace';
import * as path from 'path';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Schema } from '../schema';
import { getDestination } from './utils';

interface PartialCypressJson {
  videosFolder: string;
  screenshotsFolder: string;
}

/**
 * Updates the videos and screenshots folders in the cypress.json if it exists (i.e. we're moving an e2e project)
 *
 * (assume relative paths have been updated previously)
 *
 * @param schema The options provided to the schematic
 */
export function updateCypressJson(schema: Schema): Rule {
  return (tree: Tree, _context: SchematicContext): Observable<Tree> => {
    return from(getWorkspace(tree)).pipe(
      map((workspace) => {
        const project = workspace.projects.get(schema.projectName);
        const destination = getDestination(schema, workspace, tree);

        const cypressJsonPath = path.join(destination, 'cypress.json');

        if (!tree.exists(cypressJsonPath)) {
          // nothing to do
          return tree;
        }

        const cypressJson = JSON.parse(
          tree.read(cypressJsonPath).toString('utf-8')
        ) as PartialCypressJson;
        cypressJson.videosFolder = cypressJson.videosFolder.replace(
          project.root,
          destination
        );
        cypressJson.screenshotsFolder = cypressJson.screenshotsFolder.replace(
          project.root,
          destination
        );

        tree.overwrite(cypressJsonPath, JSON.stringify(cypressJson));

        return tree;
      })
    );
  };
}
