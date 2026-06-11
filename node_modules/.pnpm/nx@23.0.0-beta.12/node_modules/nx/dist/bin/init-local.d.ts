import { WorkspaceTypeAndRoot } from '../src/utils/find-workspace-root';
/**
 * Nx is being run inside a workspace.
 *
 * @param workspace Relevant local workspace properties
 */
export declare function initLocal(workspace: WorkspaceTypeAndRoot): Promise<void>;
export declare function rewriteTargetsAndProjects(args: string[]): string[];
