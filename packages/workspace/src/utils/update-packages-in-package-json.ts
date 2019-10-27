import { updateJsonInTree } from './ast-utils';
import { readFileSync } from 'fs';

export function updatePackagesInPackageJson(
  migrationFilePath: string,
  versionName: string
) {
  const migrations = JSON.parse(readFileSync(migrationFilePath).toString());
  const packageJsonUpdates = migrations.packageJsonUpdates[versionName];

  // should never happen
  if (!packageJsonUpdates) {
    throw new Error(`Cannot find ${versionName} in migrations.json`);
  }

  const updatedPackages = packageJsonUpdates.packages;
  return updateJsonInTree('package.json', json => {
    Object.keys(updatedPackages).forEach(p => {
      if (json.devDependencies && json.devDependencies[p]) {
        json.devDependencies[p] = updatedPackages[p].version;
      } else if (json.dependencies && json.dependencies[p]) {
        json.dependencies[p] = updatedPackages[p].version;
      } else if (updatedPackages[p].alwaysAddToPackageJson) {
        if (!json.dependencies) json.dependencies = {};
        json.dependencies[p] = updatedPackages[p].version;
      }
    });
    return json;
  });
}
