import { ProjectGraph, ProjectGraphNode } from '@nrwl/workspace';

export declare global {
  export interface Window {
    projects: ProjectGraphNode[];
    graph: ProjectGraph;
    filteredProjects: ProjectGraphNode[];
    affected: string[];
    exclude: string[];
    focusedProject: string;
    groupByFolder: boolean;
    focusProject: Function;
    unfocusProject: Function;
    excludeProject: Function;
    selectAffectedProjects: Function;
    filterProjects: Function;
    selectAllProjects: Function;
    deselectAllProjects: Function;
  }
}
