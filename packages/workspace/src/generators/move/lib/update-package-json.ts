import { readJson, Tree } from '@nrwl/devkit';
import * as path from 'path';
import { NormalizedSchema } from '../schema';

interface PartialPackageJson {
  name: string;
}

/**
 * Updates the name in the package.json if it exists.
 *
 * @param schema The options provided to the schematic
 */
export function updatePackageJson(tree: Tree, schema: NormalizedSchema) {
  const packageJsonPath = path.join(
    schema.relativeToRootDestination,
    'package.json'
  );

  if (!tree.exists(packageJsonPath)) {
    // nothing to do
    return;
  }

  const packageJson = readJson(tree, packageJsonPath) as PartialPackageJson;
  packageJson.name = schema.importPath;
  tree.write(packageJsonPath, JSON.stringify(packageJson));
}
