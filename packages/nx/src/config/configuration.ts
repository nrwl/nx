import { readNxJson } from './nx-json';

/**
 * Returns information about where apps and libs will be created.
 *
 * @deprecated Workspace Layout will be removed in Nx v20. Generators should accept the full path via a --directory argument.
 */
export function workspaceLayout(): { appsDir: string; libsDir: string } {
  const nxJson = readNxJson();
  return {
    appsDir: nxJson.workspaceLayout?.appsDir ?? 'apps',
    libsDir: nxJson.workspaceLayout?.libsDir ?? 'libs',
  };
}

export { readNxJson } from './nx-json';
