import { Tree, Rule } from '@angular-devkit/schematics';
import { workspaces } from '@angular-devkit/core';

function createHost(tree: Tree): workspaces.WorkspaceHost {
  return {
    async readFile(path: string): Promise<string> {
      const data = tree.read(path);
      if (!data) {
        throw new Error('File not found.');
      }

      return data.toString();
    },
    async writeFile(path: string, data: string): Promise<void> {
      return tree.overwrite(path, data);
    },
    async isDirectory(path: string): Promise<boolean> {
      // approximate a directory check
      return !tree.exists(path) && tree.getDir(path).subfiles.length > 0;
    },
    async isFile(path: string): Promise<boolean> {
      return tree.exists(path);
    }
  };
}
export async function getWorkspace(tree: Tree, path = '/') {
  const host = createHost(tree);

  const { workspace } = await workspaces.readWorkspace(path, host);

  return workspace;
}
export function updateWorkspace(
  updater: (
    workspace: workspaces.WorkspaceDefinition
  ) => void | PromiseLike<void>
): Rule;
export function updateWorkspace(
  workspace: workspaces.WorkspaceDefinition
): Rule;
export function updateWorkspace(
  updaterOrWorkspace:
    | workspaces.WorkspaceDefinition
    | ((workspace: workspaces.WorkspaceDefinition) => void | PromiseLike<void>)
): Rule {
  return async (tree: Tree) => {
    const host = createHost(tree);

    if (typeof updaterOrWorkspace === 'function') {
      const { workspace } = await workspaces.readWorkspace('/', host);

      const result = updaterOrWorkspace(workspace);
      if (result !== undefined) {
        await result;
      }

      await workspaces.writeWorkspace(workspace, host);
    } else {
      await workspaces.writeWorkspace(updaterOrWorkspace, host);
    }
  };
}
