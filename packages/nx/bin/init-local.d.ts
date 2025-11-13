import { WorkspaceTypeAndRoot } from '../src/utils/find-workspace-root.js';
/**
 * Nx is being run inside a workspace.
 *
 * @param workspace Relevant local workspace properties
 */
export declare function initLocal(workspace: WorkspaceTypeAndRoot): Promise<void>;
export declare function rewriteTargetsAndProjects(args: string[]): string[];
//# sourceMappingURL=init-local.d.ts.map