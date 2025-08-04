import type {
  ProjectGraphClientResponse,
  TaskGraphClientResponse,
} from 'nx/src/command-line/graph/graph';
import { FetchProjectGraphService } from './fetch-project-graph-service';
import { LocalProjectGraphService } from './local-project-graph-service';
import { MockProjectGraphService } from './mock-project-graph-service';
import { NxConsoleProjectGraphService } from './nx-console-project-graph-service';

let projectGraphService: ProjectGraphService;

export interface ProjectGraphService {
  getHash: () => Promise<string>;
  getProjectGraph: (url: string) => Promise<ProjectGraphClientResponse>;
  getTaskGraph: (url: string) => Promise<TaskGraphClientResponse>;
  setTaskInputsUrl?: (url: string) => void;
  getExpandedTaskInputs?: (taskId: string) => Promise<Record<string, string[]>>;
  getSourceMaps?: (
    url: string
  ) => Promise<Record<string, Record<string, string[]>>>;
}

export function getProjectGraphDataService() {
  if (projectGraphService === undefined) {
    if (window.environment === 'dev') {
      projectGraphService = new FetchProjectGraphService();
    } else if (window.environment === 'watch') {
      projectGraphService = new MockProjectGraphService();
    } else if (window.environment === 'nx-console') {
      projectGraphService = new NxConsoleProjectGraphService();
    } else if (window.environment === 'release') {
      if (window.localMode === 'build') {
        projectGraphService = new LocalProjectGraphService();
      } else {
        projectGraphService = new FetchProjectGraphService();
      }
    }
  }

  return projectGraphService;
}
