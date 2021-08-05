import type { Tree } from '@nrwl/tao/src/shared/tree';
import { reformattedWorkspaceJsonOrNull } from '@nrwl/tao/src/shared/workspace';
import * as path from 'path';
import type * as Prettier from 'prettier';
import { getWorkspacePath } from '../utils/get-workspace-layout';
import { readJson, writeJson } from '../utils/json';
import { sortObjectByKeys } from '@nrwl/tao/src/utils/object-sort';

/**
 * Formats all the created or updated files using Prettier
 * @param tree - the file system tree
 */
export async function formatFiles(tree: Tree): Promise<void> {
  let prettier: typeof Prettier;
  try {
    prettier = await import('prettier');
  } catch {}

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

function updateWorkspaceJsonToMatchFormatVersion(tree: Tree) {
  const path = getWorkspacePath(tree);
  if (!path) {
    return;
  }

  try {
    const workspaceJson = readJson(tree, path);
    const reformatted = reformattedWorkspaceJsonOrNull(workspaceJson);
    if (reformatted) {
      writeJson(tree, path, reformatted);
    }
  } catch (e) {
    console.error(`Failed to format: ${path}`);
    console.error(e);
  }
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
