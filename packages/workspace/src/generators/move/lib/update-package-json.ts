import { Tree, getWorkspaceLayout } from '@nrwl/devkit';
import * as path from 'path';
import { Schema } from '../schema';
import { getDestination, normalizeSlashes } from './utils';
import { ProjectConfiguration } from '@nrwl/tao/src/shared/workspace';

interface PartialPackageJson {
  name: string;
}

/**
 * Updates the name in the package.json if it exists.
 *
 * @param schema The options provided to the schematic
 */
export function updatePackageJson(
  tree: Tree,
  schema: Schema,
  project: ProjectConfiguration
) {
  const destination = getDestination(tree, schema, project);
  const packageJsonPath = path.join(destination, 'package.json');

  if (!tree.exists(packageJsonPath)) {
    // nothing to do
    return;
  }

  const { npmScope } = getWorkspaceLayout(tree);
  const packageJson = JSON.parse(
    tree.read(packageJsonPath).toString('utf-8')
  ) as PartialPackageJson;
  packageJson.name = normalizeSlashes(`@${npmScope}/${schema.destination}`);
  tree.write(packageJsonPath, JSON.stringify(packageJson));
}
