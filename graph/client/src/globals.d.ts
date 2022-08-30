// nx-ignore-next-line
import type { DepGraphClientResponse } from 'nx/src/command-line/dep-graph';
import { AppConfig } from './app/interfaces';
import { ExternalApi } from './app/machines/externalApi';

export declare global {
  export interface Window {
    exclude: string[];
    watch: boolean;
    localMode: 'serve' | 'build';
    projectGraphResponse?: DepGraphClientResponse;
    environment: 'dev' | 'watch' | 'release' | 'nx-console';
    appConfig: AppConfig;
    useXstateInspect: boolean;
    externalApi?: ExternalApi;
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
