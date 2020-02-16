import { readFileSync } from 'fs-extra';
import { updateJsonInTree } from './ast-utils';

export function updateNxJsonDefaultBranch(
  migrationFilePath: string,
  versionName: string
) {
  const migrations = JSON.parse(readFileSync(migrationFilePath).toString());
  const nxJsonUpdates = migrations.nxJsonUpdates[versionName];

  const updatedPackages = nxJsonUpdates.defaultBranch;
  return updateJsonInTree('nx.json', json => {
    const hasBaseBranch = Object(json).hasOwnProperty('defaultBranch');
    if (!hasBaseBranch) {
      json.defaultBranch = updatedPackages.defaultBranch;
    }
    return json;
  });
}
