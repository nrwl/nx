import { ProjectConfiguration, Tree } from '@nrwl/devkit';
import * as path from 'path';
import { NormalizedSchema } from '../schema';

interface PartialCypressJson {
  videosFolder: string;
  screenshotsFolder: string;
}

/**
 * Updates the videos and screenshots folders in the cypress.json/cypress.config.ts if it exists (i.e. we're moving an e2e project)
 *
 * (assume relative paths have been updated previously)
 *
 * @param schema The options provided to the schematic
 */
export function updateCypressConfig(
  tree: Tree,
  schema: NormalizedSchema,
  project: ProjectConfiguration
) {
  const cypressJsonPath = path.join(
    schema.relativeToRootDestination,
    'cypress.json'
  );

  if (tree.exists(cypressJsonPath)) {
    const cypressJson = JSON.parse(
      tree.read(cypressJsonPath).toString('utf-8')
    ) as PartialCypressJson;
    cypressJson.videosFolder = cypressJson.videosFolder.replace(
      project.root,
      schema.relativeToRootDestination
    );
    cypressJson.screenshotsFolder = cypressJson.screenshotsFolder.replace(
      project.root,
      schema.relativeToRootDestination
    );

    tree.write(cypressJsonPath, JSON.stringify(cypressJson));
    return tree;
  }

  const cypressConfigPath = path.join(
    schema.relativeToRootDestination,
    'cypress.config.ts'
  );
  if (tree.exists(cypressConfigPath)) {
    const oldContent = tree.read(cypressConfigPath, 'utf-8');
    const findName = new RegExp(`'${schema.projectName}'`, 'g');
    const findDir = new RegExp(project.root, 'g');
    const newContent = oldContent
      .replace(findName, `'${schema.newProjectName}'`)
      .replace(findDir, schema.relativeToRootDestination);

    tree.write(cypressConfigPath, newContent);
  }
}
