import type { Tree } from '@nrwl/tao/src/shared/tree';
import { reformattedWorkspaceJsonOrNull } from '@nrwl/tao/src/shared/workspace';
import * as path from 'path';
import type * as Prettier from 'prettier';
import { getWorkspacePath } from '../utils/get-workspace-layout';
import { readJson, writeJson } from '../utils/json';
import { objectSort } from '@nrwl/tao/src/utils/object-sort';

/**
 * Formats all the created or updated files using Prettier
 * @param host - the file system tree
 */
export async function formatFiles(host: Tree): Promise<void> {
  let prettier: typeof Prettier;
  try {
    prettier = require('prettier');
  } catch {}

  updateWorkspaceJsonToMatchFormatVersion(host);
  sortWorkspaceJson(host);
  sortNxJson(host);
  sortTsConfig(host);

  if (!prettier) return;

  const files = new Set(
    host.listChanges().filter((file) => file.type !== 'DELETE')
  );
  await Promise.all(
    Array.from(files).map(async (file) => {
      const systemPath = path.join(host.root, file.path);
      let options: any = {
        filepath: systemPath,
      };

      const resolvedOptions = await prettier.resolveConfig(systemPath);
      if (!resolvedOptions) {
        return;
      }
      options = {
        ...options,
        ...resolvedOptions,
      };

      const support = await prettier.getFileInfo(systemPath, options);
      if (support.ignored || !support.inferredParser) {
        return;
      }

      try {
        host.write(
          file.path,
          prettier.format(file.content.toString('utf-8'), options)
        );
      } catch (e) {
        console.warn(`Could not format ${file.path}. Error: "${e.message}"`);
      }
    })
  );
}

function updateWorkspaceJsonToMatchFormatVersion(host: Tree) {
  const path = getWorkspacePath(host);
  if (!path) {
    return;
  }

  try {
    const workspaceJson = readJson(host, path);
    const reformatted = reformattedWorkspaceJsonOrNull(workspaceJson);
    if (reformatted) {
      writeJson(host, path, reformatted);
    }
  } catch (e) {
    console.error(`Failed to format: ${path}`);
    console.error(e);
  }
}

function sortWorkspaceJson(host: Tree) {
  const workspaceJsonPath = getWorkspacePath(host);
  try {
    const workspaceJson = readJson(host, workspaceJsonPath);
    const sortedProjects = objectSort(workspaceJson.projects);
    workspaceJson.projects = sortedProjects;
    writeJson(host, workspaceJsonPath, workspaceJson);
  } catch (e) {
    console.error(`failed to sort projects in ${workspaceJsonPath}`);
  }
}

function sortNxJson(host: Tree) {
  try {
    const nxJson = readJson(host, 'nx.json');
    const sortedProjects = objectSort(nxJson.projects);
    nxJson.projects = sortedProjects;
    writeJson(host, 'nx.json', nxJson);
  } catch (e) {
    console.error('failed to sort projects in nx.json');
  }
}

function sortTsConfig(host: Tree) {
  try {
    const tsconfig = readJson(host, 'tsconfig.base.json');
    const sortedPaths = objectSort(tsconfig.compilerOptions.paths);
    tsconfig.compilerOptions.paths = sortedPaths;
    writeJson(host, 'tsconfig.base.json', tsconfig);
  } catch (e) {
    console.error('failed to sort paths in tsconfig.base.json');
  }
}
