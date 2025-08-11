import type {
  ProjectGraphClientResponse,
  TaskGraphClientResponse,
} from 'nx/src/command-line/graph/graph';
import { ProjectGraphService } from './get-project-graph-data-service';

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

  async getSpecificTaskGraph(
    url: string,
    projects: string[] | null,
    target: string,
    configuration?: string
  ): Promise<TaskGraphClientResponse> {
    const params = new URLSearchParams();

    if (projects) {
      params.append('projects', projects.join(' '));
    }

    params.append('target', target);

    if (configuration) {
      params.append('configuration', configuration);
    }

    const request = new Request(`${url}?${params.toString()}`, {
      mode: 'no-cors',
    });

    return await fetch(request).then((res) => res.json());
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
