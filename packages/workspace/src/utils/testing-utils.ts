import { Tree } from '@angular-devkit/schematics';
import { names, toFileName } from './name-utils';
import { NxJson } from '../command-line/shared';

export function getFileContent(tree: Tree, path: string): string {
  const fileEntry = tree.get(path);

  if (!fileEntry) {
    throw new Error(`The file (${path}) does not exist.`);
  }

  return fileEntry.content.toString();
}

export function createEmptyWorkspace(tree: Tree): Tree {
  tree.create(
    '/angular.json',
    JSON.stringify({ projects: {}, newProjectRoot: '' })
  );
  tree.create(
    '/package.json',
    JSON.stringify({
      dependencies: {},
      devDependencies: {}
    })
  );
  tree.create(
    '/nx.json',
    JSON.stringify(<NxJson>{ npmScope: 'proj', projects: {} })
  );
  tree.create(
    '/tsconfig.json',
    JSON.stringify({ compilerOptions: { paths: {} } })
  );
  tree.create(
    '/tslint.json',
    JSON.stringify({
      rules: {
        'nx-enforce-module-boundaries': [
          true,
          {
            npmScope: '<%= npmScope %>',
            lazyLoad: [],
            allow: []
          }
        ]
      }
    })
  );
  return tree;
}
