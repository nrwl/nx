/**
 * Recursive function that walks back up the directory
 * tree to try and find a workspace file.
 *
 * @param dir Directory to start searching with
 */
export declare function findWorkspaceRoot(dir: string): WorkspaceTypeAndRoot | null;
export interface WorkspaceTypeAndRoot {
    type: 'nx' | 'angular';
    dir: string;
}
