/**
 * Returns information about where apps and libs will be created.
 */
export declare function workspaceLayout(): {
    appsDir: string;
    libsDir: string;
};
export { readNxJson } from './nx-json';
