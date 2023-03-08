import type { Tree } from '@angular-devkit/schematics';

import { readJsonInTree } from './ast-utils';

import type { NxJsonConfiguration } from '@nrwl/devkit';

/**
 * @deprecated Nx no longer supports workspace.json
 */
export function getWorkspacePath(host: Tree) {
  const possibleFiles = ['/angular.json', '/workspace.json'];
  return possibleFiles.filter((path) => host.exists(path))[0];
}

export function getNpmScope(host: Tree): string {
  return readJsonInTree<NxJsonConfiguration>(host, 'nx.json').npmScope;
}

export function parseTarget(targetString: string) {
  const [project, target, config] = targetString.split(':');
  return {
    project,
    target,
    config,
  };
}

export function editTarget(targetString: string, callback) {
  const parsedTarget = parseTarget(targetString);
  return serializeTarget(callback(parsedTarget));
}

export function serializeTarget({ project, target, config }) {
  return [project, target, config].filter((part) => !!part).join(':');
}
