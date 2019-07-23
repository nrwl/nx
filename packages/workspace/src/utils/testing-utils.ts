import {
  Tree,
  MergeStrategy,
  DirEntry,
  FileEntry,
  FilePredicate,
  UpdateRecorder,
  Action
} from '@angular-devkit/schematics';
import { NxJson } from '../command-line/shared';
import {
  _test_addWorkspaceFile,
  WorkspaceFormat
} from '@angular-devkit/core/src/workspace/core';

export function getFileContent(tree: Tree, path: string): string {
  const fileEntry = tree.get(path);

  if (!fileEntry) {
    throw new Error(`The file (${path}) does not exist.`);
  }

  return fileEntry.content.toString();
}

export function createEmptyWorkspace(tree: Tree): Tree {
  _test_addWorkspaceFile('workspace.json', WorkspaceFormat.JSON);

  tree.create(
    '/workspace.json',
    JSON.stringify({ version: 1, projects: {}, newProjectRoot: '' })
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
