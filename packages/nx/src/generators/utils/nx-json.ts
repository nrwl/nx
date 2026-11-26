import { relative } from 'path';
import type { NxJsonConfiguration } from '../../config/nx-json';

import type { Tree } from '../tree';

import { readJson, updateJson } from './json';

/**
 * Reads nx.json
 */
export function readNxJson(tree: Tree): NxJsonConfiguration | null {
  if (!tree.exists('nx.json')) {
    return null;
  }
  let nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
  if (nxJson.extends) {
    nxJson = { ...readNxJsonExtends(tree, nxJson.extends), ...nxJson };
  }
  return nxJson;
}

/**
 * Update nx.json
 */
export function updateNxJson(tree: Tree, nxJson: NxJsonConfiguration): void {
  if (tree.exists('nx.json')) {
    updateJson<NxJsonConfiguration, object>(tree, 'nx.json', (json) => {
      if (json.extends) {
        const nxJsonExtends = readNxJsonExtends(tree, json.extends);
        const changedPropsOfNxJson: Record<string, unknown> = {};
        Object.entries(nxJson).forEach(([prop, value]) => {
          if (
            JSON.stringify(value, null, 2) !=
            JSON.stringify(nxJsonExtends[prop], null, 2)
          ) {
            changedPropsOfNxJson[prop] = value;
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
    let resolvedExtendsPath: string;
    try {
      resolvedExtendsPath = require.resolve(extendsPath, {
        paths: [tree.root],
      });
    } catch {
      // Tree roots without a node_modules folder (e.g. the in-memory trees
      // used in tests) can't anchor module resolution; fall back to
      // resolving from the running nx package.
      resolvedExtendsPath = require.resolve(extendsPath);
    }
    return readJson(tree, relative(tree.root, resolvedExtendsPath));
  } catch (e) {
    throw new Error(
      `Unable to resolve nx.json extends. Error: ${e instanceof Error ? e.message : String(e)}`
    );
  }
}
