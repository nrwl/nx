import type {
  ProjectGraphClientResponse,
  TaskGraphClientResponse,
  TaskGraphMetadata,
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

  async getTaskGraphMetadata(url: string): Promise<TaskGraphMetadata> {
    const request = new Request(url, { mode: 'no-cors' });
    console.log('here???', request);

    const response = await fetch(request);

    return response.json();
  }

  async getSpecificTaskGraph(
    url: string,
    projects: string | string[] | null,
    target: string,
    configuration?: string
  ): Promise<TaskGraphClientResponse> {
    const params = new URLSearchParams();

    if (projects) {
      if (Array.isArray(projects)) {
        // Multiple projects from UI
        params.append('projects', projects.join(' '));
      } else {
        // Single project from CLI
        params.append('project', projects);
      }
    }

    params.append('target', target);

    if (configuration) {
      params.append('configuration', configuration);
    }

    const request = new Request(`${url}?${params.toString()}`, {
      mode: 'no-cors',
    });

    const response = await fetch(request);

    return response.json();
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
