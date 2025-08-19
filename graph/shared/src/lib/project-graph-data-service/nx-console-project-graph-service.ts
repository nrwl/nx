import type {
  ProjectGraphClientResponse,
  TaskGraphClientResponse,
} from 'nx/src/command-line/graph/graph';
import { ProjectGraphService } from './get-project-graph-data-service';

export class NxConsoleProjectGraphService implements ProjectGraphService {
  private expandedTaskInputsCache = new Map<string, Record<string, string[]>>();
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
    // Check cache first
    if (this.expandedTaskInputsCache.has(taskId)) {
      return this.expandedTaskInputsCache.get(taskId)!;
    }

    const res = await window.externalApi.loadExpandedTaskInputs?.(taskId);
    const result = res ? res[taskId] : {};
    
    // Cache the result
    this.expandedTaskInputsCache.set(taskId, result);
    
    return result;
  }

  async getSpecificTaskGraph(
    url: string,
    projects: string | string[] | null,
    target: string,
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
