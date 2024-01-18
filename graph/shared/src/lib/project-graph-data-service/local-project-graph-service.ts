/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type {
  ProjectGraphClientResponse,
  TaskGraphClientResponse,
} from 'nx/src/command-line/graph/graph';
import { ProjectGraphService } from './get-project-graph-data-service';
/* eslint-enable @nx/enforce-module-boundaries */

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

  async getExpandedTaskInputs(
    taskId: string
  ): Promise<Record<string, string[]>> {
    return new Promise((resolve) =>
      resolve(window.expandedTaskInputsResponse[taskId])
    );
  }

  async getSourceMaps(
    url: string
  ): Promise<Record<string, Record<string, string[]>>> {
    return new Promise((resolve) => resolve(window.sourceMapsResponse));
  }
}
