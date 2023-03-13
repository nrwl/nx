import type { Tree } from '@angular-devkit/schematics';

/**
 * @deprecated Nx no longer supports workspace.json
 */
export function getWorkspacePath(host: Tree) {
  const possibleFiles = ['/angular.json', '/workspace.json'];
  return possibleFiles.filter((path) => host.exists(path))[0];
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
