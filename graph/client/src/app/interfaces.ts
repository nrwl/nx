/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type {
  ProjectGraphClientResponse,
  TaskGraphClientResponse,
} from 'nx/src/command-line/graph/graph';

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

export interface Environment {
  environment: 'dev' | 'watch' | 'release';
}
