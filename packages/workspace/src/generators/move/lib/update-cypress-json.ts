import { Tree } from '@nrwl/devkit';
import * as path from 'path';
import { Schema } from '../schema';
import { getDestination } from './utils';
import { ProjectConfiguration } from '@nrwl/tao/src/shared/workspace';

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
export function updateCypressJson(
  tree: Tree,
  schema: Schema,
  project: ProjectConfiguration
) {
  const destination = getDestination(tree, schema, project);

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

  tree.write(cypressJsonPath, JSON.stringify(cypressJson));
}
