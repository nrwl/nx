// nx-ignore-next-line
import { DepGraphClientResponse } from '@nrwl/workspace/src/command-line/dep-graph';
import { ProjectGraph, ProjectGraphNode } from '@nrwl/devkit';
import { ProjectGraphList } from './graphs';

export declare global {
  export interface Window {
    watch: boolean;
    projects: ProjectGraphNode[];
    graph: ProjectGraph;
    filteredProjects: ProjectGraphNode[];
    affected: string[];
    exclude: string[];
    focusedProject: string;
    groupByFolder: boolean;
    focusProject: Function;
    excludeProject: Function;
    projectGraphList: ProjectGraphList[];
    selectedProjectGraph: string;
    workspaceLayout: {
      libsDir: string;
      appsDir: string;
    };
    projectGraphResponse: DepGraphClientResponse;
    localMode: 'serve' | 'build';
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
