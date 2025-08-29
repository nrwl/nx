// nx-ignore-next-line
import type { ProjectGraphClientResponse } from 'nx/src/command-line/graph/graph';
import { ProjectGraphService } from './get-project-graph-data-service';
import type { TaskGraphClientResponse } from '../task-graph-client-response';

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

  async getSpecificTaskGraph(
    url: string,
    projects: string | string[] | null,
    targets: string[],
    configuration?: string
  ): Promise<TaskGraphClientResponse> {
    // Use the regular task graph loading through external API
    // NxConsole will handle the filtering
    return await window.externalApi.loadTaskGraph?.(url);
  }

  async getSourceMaps(
    url: string
  ): Promise<Record<string, Record<string, string[]>>> {
    return await window.externalApi.loadSourceMaps?.(url);
  }
}
