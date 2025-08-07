import type {
  ExpandedTaskInputsReponse,
  ProjectGraphClientResponse,
  TaskGraphClientResponse,
  TaskGraphMetadata,
} from 'nx/src/command-line/graph/graph';
import { AppConfig } from './lib/app-config';
import { ExternalApi } from './lib/external-api';

export declare global {
  interface Window {
    exclude: string[];
    watch: boolean;
    localMode: 'serve' | 'build';
    projectGraphResponse?: ProjectGraphClientResponse;
    taskGraphResponse?: TaskGraphClientResponse;
    taskGraphMetadataResponse?: TaskGraphMetadata;
    expandedTaskInputsResponse?: ExpandedTaskInputsReponse;
    sourceMapsResponse?: Record<string, Record<string, string[]>>;
    environment: 'dev' | 'watch' | 'release' | 'nx-console';
    appConfig: AppConfig;
    useXstateInspect: boolean;
    externalApi?: ExternalApi;
  }
}
