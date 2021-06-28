import { DepGraphClientResponse } from '@nrwl/workspace';
import { ProjectGraphService } from './models';

export class LocalProjectGraphService implements ProjectGraphService {
  async getHash(): Promise<string> {
    return new Promise((resolve) => resolve('some-hash'));
  }

  async getProjectGraph(url: string): Promise<DepGraphClientResponse> {
    return new Promise((resolve) => resolve(window.projectGraphResponse));
  }
}
