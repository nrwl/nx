import { sortObjectByKeys } from '@nrwl/tao/src/utils/object-sort';
import * as path from 'path';

import { getWorkspacePath } from '../utils/get-workspace-layout';
import { readJson, writeJson } from '../utils/json';
import { updateWorkspaceJsonToMatchFormatVersion } from './update-workspace-json-to-match-format-version';

import type { Tree } from '@nrwl/tao/src/shared/tree';
import type * as Prettier from 'prettier';

/**
 * Formats all the created or updated files using Prettier
 * @param tree - the file system tree
 */
export async function formatFiles(tree: Tree): Promise<void> {
  let prettier: typeof Prettier;
  try {
    prettier = await import('prettier');
  } catch {}

  // Calling formatFiles() within generators to support old workspace format is weird,
  // should be removed but it's breaking change for devkit users.
  updateWorkspaceJsonToMatchFormatVersion(tree);

  sortWorkspaceJson(tree);
  sortNxJson(tree);
  sortTsConfig(tree);

  if (!prettier) return;

  const files = new Set(
    tree.listChanges().filter((file) => file.type !== 'DELETE')
  );
  await Promise.all(
    Array.from(files).map(async (file) => {
      const systemPath = path.join(tree.root, file.path);
      let options: Prettier.Options = {
        filepath: systemPath,
      };

      const resolvedOptions = await prettier.resolveConfig(systemPath, {
        editorconfig: true,
      });
      if (!resolvedOptions) {
        return;
      }
      options = {
        ...options,
        ...resolvedOptions,
      };

      const support = await prettier.getFileInfo(systemPath);
      if (support.ignored || !support.inferredParser) {
        return;
      }

      try {
        tree.write(
          file.path,
          prettier.format(file.content.toString('utf-8'), options)
        );
      } catch (e) {
        console.warn(`Could not format ${file.path}. Error: "${e.message}"`);
      }
    })
  );
}

function sortWorkspaceJson(tree: Tree) {
  const workspaceJsonPath = getWorkspacePath(tree);
  if (!path) {
    return;
  }

  try {
    const workspaceJson = readJson(tree, workspaceJsonPath);
    if (Object.entries(workspaceJson.projects).length !== 0) {
      const sortedProjects = sortObjectByKeys(workspaceJson.projects);
      writeJson(tree, workspaceJsonPath, {
        ...workspaceJson,
        projects: sortedProjects,
      });
    }
  } catch (e) {
    // catch noop
  }
}

function sortNxJson(tree: Tree) {
  try {
    const nxJson = readJson(tree, 'nx.json');
    const sortedProjects = sortObjectByKeys(nxJson.projects);
    writeJson(tree, 'nx.json', {
      ...nxJson,
      projects: sortedProjects,
    });
  } catch (e) {
    // catch noop
  }
}

function sortTsConfig(tree: Tree) {
  try {
    const tsconfig = readJson(tree, 'tsconfig.base.json');
    const sortedPaths = sortObjectByKeys(tsconfig.compilerOptions.paths);
    writeJson(tree, 'tsconfig.base.json', {
      ...tsconfig,
      compilerOptions: {
        ...tsconfig.compilerOptions,
        paths: sortedPaths,
      },
    });
  } catch (e) {
    // catch noop
  }
}
