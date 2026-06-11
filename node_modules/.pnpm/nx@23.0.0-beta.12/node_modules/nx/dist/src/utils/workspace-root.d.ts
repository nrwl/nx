/**
 * The root of the workspace
 */
export declare let workspaceRoot: string;
export declare function setWorkspaceRoot(root: string): void;
export declare function workspaceRootInner(dir: string, candidateRoot: string | null): string;
