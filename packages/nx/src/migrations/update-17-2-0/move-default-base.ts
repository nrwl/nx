/* eslint-disable @typescript-eslint/no-unused-vars */
import { readNxJson, updateNxJson } from '../../generators/utils/nx-json.js';
import { Tree } from '../../generators/tree.js';
import { NxJsonConfiguration } from '../../config/nx-json.js';
import { formatChangedFilesWithPrettierIfAvailable } from '../../generators/internal-utils/format-changed-files-with-prettier-if-available.js';

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
