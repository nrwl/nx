/* eslint-disable @typescript-eslint/no-unused-vars */
import { readNxJson, updateNxJson } from '../../generators/utils/nx-json';
import { Tree } from '../../generators/tree';
import { NxJsonConfiguration } from '../../config/nx-json';
import { formatChangedFilesWithPrettierIfAvailable } from '../../generators/internal-utils/format-changed-files-with-prettier-if-available';

/**
 * Updates existing workspaces to move nx.json's affected.defaultBase to nx.json's base.
 */
export default async function update(host: Tree) {
  const nxJson = readNxJson(host) as NxJsonConfiguration & {
    affected: { defaultBase?: string };
  };
  if (nxJson?.affected?.defaultBase) {
    nxJson.defaultBase = nxJson.affected.defaultBase;
    delete nxJson.affected.defaultBase;
    if (Object.keys(nxJson.affected).length === 0) {
      delete nxJson.affected;
    }
    updateNxJson(host, nxJson);
  }
  await formatChangedFilesWithPrettierIfAvailable(host);
}
