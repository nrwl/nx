// nx-ignore-next-line
import type { ProjectGraphClientResponse } from 'nx/src/command-line/graph/graph';
import { ProjectGraphService } from './get-project-graph-data-service';
import type { TaskGraphClientResponse } from '../task-graph-client-response';

export class LocalProjectGraphService implements ProjectGraphService {
  async getHash(): Promise<string> {
    return new Promise((resolve) => resolve('some-hash'));
  }

  async getProjectGraph(_url: string): Promise<ProjectGraphClientResponse> {
    return new Promise((resolve) => resolve(window.projectGraphResponse));
  }

  async getTaskGraph(_url: string): Promise<TaskGraphClientResponse> {
    return new Promise((resolve) => resolve(window.taskGraphResponse));
  }

  async getExpandedTaskInputs(
    taskId: string
  ): Promise<Record<string, string[]>> {
    return new Promise((resolve) =>
      resolve(window.expandedTaskInputsResponse[taskId])
    );
  }

  async getSpecificTaskGraph(
    _url: string,
    projects: string | string[] | null,
    targets: string[],
    configuration?: string
  ): Promise<TaskGraphClientResponse> {
    // In local mode, we still return the full task graph
    // The filtering would happen on the client side if needed
    return new Promise((resolve) => resolve(window.taskGraphResponse));
  }

  async getSourceMaps(
    _url: string
  ): Promise<Record<string, Record<string, string[]>>> {
    return new Promise((resolve) => resolve(window.sourceMapsResponse));
  }
}
