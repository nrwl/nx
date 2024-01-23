/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type {
  ProjectGraphClientResponse,
  TaskGraphClientResponse,
} from 'nx/src/command-line/graph/graph';
import { ProjectGraphService } from './get-project-graph-data-service';

export class NxConsoleProjectGraphService implements ProjectGraphService {
  async getHash(): Promise<string> {
    return new Promise((resolve) => resolve('some-hash'));
  }

  async getProjectGraph(url: string): Promise<ProjectGraphClientResponse> {
    return await window.externalApi.loadProjectGraph?.(url);
  }

  async getTaskGraph(url: string): Promise<TaskGraphClientResponse> {
    return await window.externalApi.loadTaskGraph?.(url);
  }

  async getExpandedTaskInputs(
    taskId: string
  ): Promise<Record<string, string[]>> {
    const res = await window.externalApi.loadExpandedTaskInputs?.(taskId);
    return res ? res[taskId] : {};
  }

  async getSourceMaps(
    url: string
  ): Promise<Record<string, Record<string, string[]>>> {
    return await window.externalApi.loadSourceMaps?.(url);
  }
}
