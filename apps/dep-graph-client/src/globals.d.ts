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
    excludeProject: Function;
  }
}

declare module 'cytoscape' {
  interface Core {
    anywherePanning: Function;
  }

  interface ElementDefinition {
    pannable?: boolean;
  }

  interface NodeSingular {
    popperRef: Function;
    pannable: () => boolean;
  }

  namespace Css {
    interface EdgeLine {
      'edge-text-rotation'?: string;
    }
  }
}
