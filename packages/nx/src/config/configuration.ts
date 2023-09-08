import { readNxJson } from './nx-json';

/**
 * Returns information about where apps and libs will be created.
 */
export function workspaceLayout(): { appsDir: string; libsDir: string } {
  const nxJson = readNxJson();
  return {
    appsDir: nxJson.workspaceLayout?.appsDir ?? 'apps',
    libsDir: nxJson.workspaceLayout?.libsDir ?? 'libs',
  };
}

export { readNxJson } from './nx-json';
