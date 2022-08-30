// nx-ignore-next-line
import type { DepGraphClientResponse } from 'nx/src/command-line/dep-graph';
import { ProjectGraphService } from './interfaces';

export class FetchProjectGraphService implements ProjectGraphService {
  async getHash(): Promise<string> {
    const request = new Request('currentHash', { mode: 'no-cors' });

    const response = await fetch(request);

    return response.json();
  }

  async getProjectGraph(url: string): Promise<DepGraphClientResponse> {
    const request = new Request(url, { mode: 'no-cors' });

    const response = await fetch(request);

    return response.json();
  }
}
