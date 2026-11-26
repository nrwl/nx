// nx-ignore-next-line
import type {
  ProjectGraphClientResponse,
  TaskGraphClientResponse,
} from 'nx/src/command-line/graph/graph';
import { ProjectGraphService } from './get-project-graph-data-service';

function requireWindowResponse<T>(value: T | undefined, name: string): T {
  if (value === undefined) {
    throw new Error(`window.${name} is not set`);
  }
  return value;
}

export class LocalProjectGraphService implements ProjectGraphService {
  async getHash(): Promise<string> {
    return new Promise((resolve) => resolve('some-hash'));
  }

  async getProjectGraph(_url: string): Promise<ProjectGraphClientResponse> {
    return new Promise((resolve) =>
      resolve(
        requireWindowResponse(
          window.projectGraphResponse,
          'projectGraphResponse'
        )
      )
    );
  }

  async getTaskGraph(_url: string): Promise<TaskGraphClientResponse> {
    return new Promise((resolve) =>
      resolve(
        requireWindowResponse(window.taskGraphResponse, 'taskGraphResponse')
      )
    );
  }

  async getExpandedTaskInputs(
    taskId: string
  ): Promise<Record<string, string[]>> {
    return new Promise((resolve) =>
      resolve(
        requireWindowResponse(
          window.expandedTaskInputsResponse,
          'expandedTaskInputsResponse'
        )[taskId]
      )
    );
  }

  async getSpecificTaskGraph(
    _url: string,
    projects: string[] | null | undefined,
    targets: string[],
    configuration?: string
  ): Promise<TaskGraphClientResponse> {
    // In local mode, we still return the full task graph
    // The filtering would happen on the client side if needed
    return new Promise((resolve) =>
      resolve(
        requireWindowResponse(window.taskGraphResponse, 'taskGraphResponse')
      )
    );
  }

  async getSourceMaps(
    _url: string
  ): Promise<Record<string, Record<string, string[]>>> {
    return new Promise((resolve) =>
      resolve(
        requireWindowResponse(window.sourceMapsResponse, 'sourceMapsResponse')
      )
    );
  }
}
