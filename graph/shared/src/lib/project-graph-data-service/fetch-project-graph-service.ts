/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type {
  ProjectGraphClientResponse,
  TaskGraphClientResponse,
} from 'nx/src/command-line/graph/graph';
import { ProjectGraphService } from './get-project-graph-data-service';
/* eslint-enable @nx/enforce-module-boundaries */

export class FetchProjectGraphService implements ProjectGraphService {
  private taskInputsUrl: string;

  async getHash(): Promise<string> {
    const request = new Request('currentHash', { mode: 'no-cors' });

    const response = await fetch(request);

    return response.json();
  }

  async getProjectGraph(url: string): Promise<ProjectGraphClientResponse> {
    const request = new Request(url, { mode: 'no-cors' });

    const response = await fetch(request);

    return response.json();
  }

  async getTaskGraph(url: string): Promise<TaskGraphClientResponse> {
    const request = new Request(url, { mode: 'no-cors' });

    const response = await fetch(request);

    return response.json();
  }

  async getSourceMaps(
    url: string
  ): Promise<Record<string, Record<string, string[]>>> {
    const request = new Request(url, { mode: 'no-cors' });

    const response = await fetch(request);

    return response.json();
  }

  setTaskInputsUrl(url: string) {
    this.taskInputsUrl = url;
  }

  async getExpandedTaskInputs(
    taskId: string
  ): Promise<Record<string, string[]>> {
    if (!this.taskInputsUrl) {
      return {};
    }
    const request = new Request(`${this.taskInputsUrl}?taskId=${taskId}`, {
      mode: 'no-cors',
    });

    const response = await fetch(request);
    return (await response.json())[taskId];
  }
}
