/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type {
  ProjectGraphClientResponse,
  TaskGraphClientResponse,
} from 'nx/src/command-line/graph/graph';
/* eslint-enable @nx/enforce-module-boundaries */
import { ProjectGraphService } from './interfaces';

export class FetchProjectGraphService implements ProjectGraphService {
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
}
