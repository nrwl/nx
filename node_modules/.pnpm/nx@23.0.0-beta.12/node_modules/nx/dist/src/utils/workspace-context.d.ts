import type { NxWorkspaceFilesExternals } from '../native';
export declare function setupWorkspaceContext(workspaceRoot: string): void;
export declare function getNxWorkspaceFilesFromContext(workspaceRoot: string, projectRootMap: Record<string, string>, useDaemonProcess?: boolean): Promise<import("../native").NxWorkspaceFiles>;
/**
 * Sync method to get files matching globs from workspace context.
 * NOTE: This method will create the workspace context if it doesn't exist.
 * It should only be used within Nx internal in code paths that **must** be sync.
 * If used in an isolated plugin thread this will cause the workspace context
 * to be recreated which is slow.
 */
export declare function globWithWorkspaceContextSync(workspaceRoot: string, globs: string[], exclude?: string[]): string[];
export declare function globWithWorkspaceContext(workspaceRoot: string, globs: string[], exclude?: string[]): Promise<string[]>;
export declare function multiGlobWithWorkspaceContext(workspaceRoot: string, globs: string[], exclude?: string[]): Promise<string[][]>;
export declare function hashWithWorkspaceContext(workspaceRoot: string, globs: string[], exclude?: string[]): Promise<string>;
export declare function hashMultiGlobWithWorkspaceContext(workspaceRoot: string, globGroups: string[][]): Promise<string[]>;
export declare function updateContextWithChangedFiles(workspaceRoot: string, createdFiles: string[], updatedFiles: string[], deletedFiles: string[]): Promise<void>;
export declare function updateFilesInContext(workspaceRoot: string, updatedFiles: string[], deletedFiles: string[]): Record<string, string>;
export declare function getAllFileDataInContext(workspaceRoot: string): Promise<import("../native").FileData[]>;
export declare function getFilesInDirectoryUsingContext(workspaceRoot: string, dir: string): Promise<string[]>;
export declare function updateProjectFiles(projectRootMappings: Record<string, string>, rustReferences: NxWorkspaceFilesExternals, updatedFiles: Record<string, string>, deletedFiles: string[]): import("../native").UpdatedWorkspaceFiles;
export declare function resetWorkspaceContext(): void;
