// nx-ignore-next-line
import type {
  ExpandedTaskInputsReponse,
  ProjectGraphClientResponse,
} from 'nx/src/command-line/graph/graph';
import type { AppConfig } from './app-config';
import type { ExternalApi } from './external-api';
import type { TaskGraphClientResponse } from './task-graph-client-response';

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
  }
}
