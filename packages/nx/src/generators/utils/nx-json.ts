import { relative } from 'path';
import type { NxJsonConfiguration } from '../../config/nx-json';

import type { Tree } from '../tree';

import { readJson, updateJson } from './json';
import { readNxJson as readNxJsonFromDisk } from '../../config/nx-json';

/**
 * @deprecated You must pass a {@link Tree}. This will be removed in Nx 21.
 */
export function readNxJson(): NxJsonConfiguration | null;
export function readNxJson(tree: Tree): NxJsonConfiguration | null;

/**
 * Reads nx.json
 */
export function readNxJson(tree?: Tree): NxJsonConfiguration | null {
  if (tree) {
    if (!tree.exists('nx.json')) {
      return null;
    }
    let nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
    if (nxJson.extends) {
      nxJson = { ...readNxJsonExtends(tree, nxJson.extends), ...nxJson };
    }
    return nxJson;
  } else {
    return readNxJsonFromDisk();
  }
}

/**
 * Update nx.json
 */
export function updateNxJson(tree: Tree, nxJson: NxJsonConfiguration): void {
  if (tree.exists('nx.json')) {
    updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
      if (json.extends) {
        const nxJsonExtends = readNxJsonExtends(tree, json.extends);
        const changedPropsOfNxJson = {};
        Object.keys(nxJson).forEach((prop) => {
          if (
            JSON.stringify(nxJson[prop], null, 2) !=
            JSON.stringify(nxJsonExtends[prop], null, 2)
          ) {
            changedPropsOfNxJson[prop] = nxJson[prop];
          }
        });
        return changedPropsOfNxJson;
      } else {
        return nxJson;
      }
    });
  }
}

function readNxJsonExtends(tree: Tree, extendsPath: string) {
  try {
    return readJson(
      tree,
      relative(
        tree.root,
        require.resolve(extendsPath, {
          paths: [tree.root],
        })
      )
    );
  } catch (e) {
    throw new Error(`Unable to resolve nx.json extends. Error: ${e.message}`);
  }
}
