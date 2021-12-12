// nx-ignore-next-line
import { DepGraphClientResponse } from '@nrwl/workspace/src/command-line/dep-graph';
import { ProjectGraph, ProjectGraphNode } from '@nrwl/devkit';
import { ProjectGraphList } from './graphs';
import { AppConfig } from './app/models';

export declare global {
  export interface Window {
    exclude: string[];
    focusedProject: string;
    groupByFolder: boolean;
    watch: boolean;
    localMode: 'serve' | 'build';
    projectGraphResponse?: DepGraphClientResponse;
    environment: 'dev' | 'watch' | 'release';
    appConfig: AppConfig;
    useXstateInspect: boolean = false;
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
