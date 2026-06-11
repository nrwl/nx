import type { FileData, FileMap, ProjectFileMap, ProjectGraph } from '../config/project-graph';
import type { ProjectConfiguration, ProjectsConfigurations } from '../config/workspace-json-project-json';
import { NxWorkspaceFilesExternals } from '../native';
export interface WorkspaceFileMap {
    fileMap: FileMap;
    /**
     * @deprecated Derived from `fileMap.projectFileMap` + `fileMap.nonProjectFiles`.
     * Will be removed in a future major. Compute it locally if needed.
     */
    allWorkspaceFiles?: FileData[];
}
export declare function createProjectFileMapUsingProjectGraph(graph: ProjectGraph): Promise<ProjectFileMap>;
export declare function createFileMapUsingProjectGraph(graph: ProjectGraph): Promise<WorkspaceFileMap>;
export declare function createFileMap(projectsConfigurations: ProjectsConfigurations, allWorkspaceFiles: FileData[]): WorkspaceFileMap;
export declare function updateFileMap(projectsConfigurations: Record<string, ProjectConfiguration>, rustReferences: NxWorkspaceFilesExternals, updatedFiles: Record<string, string>, deletedFiles: string[]): {
    fileMap: import("../native").FileMap;
    rustReferences: NxWorkspaceFilesExternals;
};
