/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type {
  ExpandedTaskInputsReponse,
  ProjectGraphClientResponse,
  TaskGraphClientResponse,
} from 'nx/src/command-line/graph/graph';
import type { AppConfig, ExternalApi } from '@nx/graph/shared';

export declare global {
  interface Window {
    exclude: string[];
    watch: boolean;
    localMode: 'serve' | 'build';
    projectGraphResponse?: ProjectGraphClientResponse;
    taskGraphResponse?: TaskGraphClientResponse;
    expandedTaskInputsResponse?: ExpandedTaskInputsReponse;
    sourceMapsResponse?: Record<string, Record<string, string[]>>;
    environment: 'dev' | 'watch' | 'release' | 'nx-console';
    appConfig: AppConfig;
    useXstateInspect: boolean;
    externalApi?: ExternalApi;

    // using bundled graph components directly from outside the graph app
    __NX_RENDER_GRAPH__?: boolean;
    renderPDV?: (data: any) => void;
    renderError?: (data: any) => void;
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

  interface EdgeSingular {
    popperRef: Function;
  }

  namespace Css {
    interface EdgeLine {
      'edge-text-rotation'?: string;
    }
  }
}
