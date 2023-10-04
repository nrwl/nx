/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type {
  ProjectGraphClientResponse,
  TaskGraphClientResponse,
} from 'nx/src/command-line/graph/graph';
/* eslint-enable @nx/enforce-module-boundaries */
import { ProjectGraphService } from './interfaces';

export class LocalProjectGraphService implements ProjectGraphService {
  async getHash(): Promise<string> {
    return new Promise((resolve) => resolve('some-hash'));
  }

  async getProjectGraph(url: string): Promise<ProjectGraphClientResponse> {
    return new Promise((resolve) => resolve(window.projectGraphResponse));
  }

  async getTaskGraph(url: string): Promise<TaskGraphClientResponse> {
    return new Promise((resolve) => resolve(window.taskGraphResponse));
  }
}
