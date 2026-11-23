// nx-ignore-next-line
import type {
  ProjectGraphClientResponse,
  TaskGraphClientResponse,
} from 'nx/src/command-line/graph/graph';
import type { ExternalApi } from '../external-api';
import { ProjectGraphService } from './get-project-graph-data-service';

function getExternalApi(): ExternalApi {
  if (!window.externalApi) {
    throw new Error('window.externalApi is not set');
  }
  return window.externalApi;
}

function getLoader<
  K extends 'loadProjectGraph' | 'loadTaskGraph' | 'loadSourceMaps',
>(name: K): NonNullable<ExternalApi[K]> {
  const loader = getExternalApi()[name];
  if (!loader) {
    throw new Error(`externalApi.${name} is not registered`);
  }
  return loader;
}

export class NxConsoleProjectGraphService implements ProjectGraphService {
  async getHash(): Promise<string> {
    return new Promise((resolve) => resolve('some-hash'));
  }

  async getProjectGraph(url: string): Promise<ProjectGraphClientResponse> {
    return await getLoader('loadProjectGraph')(url);
  }

  async getTaskGraph(url: string): Promise<TaskGraphClientResponse> {
    return await getLoader('loadTaskGraph')(url);
  }

  async getExpandedTaskInputs(
    taskId: string
  ): Promise<Record<string, string[]>> {
    const res = await getExternalApi().loadExpandedTaskInputs?.(taskId);
    return res ? res[taskId] : {};
  }

  async getSpecificTaskGraph(
    url: string,
    projects: string[] | null | undefined,
    targets: string[],
    configuration?: string
  ): Promise<TaskGraphClientResponse> {
    // Use the regular task graph loading through external API
    // NxConsole will handle the filtering
    return await getLoader('loadTaskGraph')(url);
  }

  async getSourceMaps(
    url: string
  ): Promise<Record<string, Record<string, string[]>>> {
    return await getLoader('loadSourceMaps')(url);
  }
}
