// nx-ignore-next-line
import type {
  ProjectGraphDependency,
  ProjectGraphProjectNode,
} from '@nx/devkit';
// nx-ignore-next-line
import type {
  ProjectGraphClientResponse,
  TaskGraphClientResponse,
} from 'nx/src/command-line/graph/graph';
import { ProjectGraphService } from './get-project-graph-data-service';

export class MockProjectGraphService implements ProjectGraphService {
  private projectGraphsResponse: ProjectGraphClientResponse = {
    hash: '79054025255fb1a26e4bc422aef54eb4',
    layout: {
      appsDir: 'apps',
      libsDir: 'libs',
    },
    projects: [
      {
        name: 'existing-app-1',
        type: 'app',
        data: {
          root: 'apps/app1',
          tags: [],
        },
      },
      {
        name: 'existing-lib-1',
        type: 'lib',
        data: {
          root: 'libs/lib1',
          tags: [],
        },
      },
    ],
    dependencies: {
      'existing-app-1': [
        {
          source: 'existing-app-1',
          target: 'existing-lib-1',
          type: 'static',
        },
      ],
      'existing-lib-1': [],
    },
    fileMap: {
      'existing-app-1': [
        {
          file: 'some/file.ts',
          hash: 'ecccd8481d2e5eae0e59928be1bc4c2d071729d7',
          deps: ['existing-lib-1'],
        },
      ],
      'exiting-lib-1': [],
    },
    affected: [],
    focus: null,
    exclude: [],
    groupByFolder: false,
    isPartial: false,
  };

  private taskGraphsResponse: TaskGraphClientResponse = {
    taskGraph: {
      roots: [],
      tasks: {},
      dependencies: {},
      continuousDependencies: {},
    },
    plans: {},
    error: null,
  };

  constructor(updateFrequency = 5000) {
    setInterval(() => this.updateResponse(), updateFrequency);
  }

  async getHash(): Promise<string> {
    return new Promise((resolve) => resolve(this.projectGraphsResponse.hash));
  }

  getProjectGraph(_url: string): Promise<ProjectGraphClientResponse> {
    return new Promise((resolve) => resolve(this.projectGraphsResponse));
  }

  getTaskGraph(_url: string): Promise<TaskGraphClientResponse> {
    return new Promise((resolve) => resolve(this.taskGraphsResponse));
  }

  getSpecificTaskGraph(
    _url: string,
    projects: string | string[] | null,
    targets: string[],
    configuration?: string
  ): Promise<TaskGraphClientResponse> {
    // In mock mode, return the full task graph
    return new Promise((resolve) => resolve(this.taskGraphsResponse));
  }

  getSourceMaps(
    _url: string
  ): Promise<Record<string, Record<string, string[]>>> {
    return new Promise((resolve) => resolve({}));
  }

  async getExpandedTaskInputs(
    taskId: string
  ): Promise<Record<string, string[]>> {
    // Generate mock data for the task
    const mockInputs: Record<string, string[]> = {
      general: ['src/**/*.ts', 'package.json'],
      [taskId.split(':')[0]]: [`${taskId.split(':')[0]}/src/**/*.ts`],
      external: ['node_modules/**/*'],
    };

    return new Promise((resolve) => resolve(mockInputs));
  }

  private createNewProject(): ProjectGraphProjectNode {
    const type = Math.random() > 0.25 ? 'lib' : 'app';
    const name = `${type}-${this.projectGraphsResponse.projects.length + 1}`;

    return {
      name,
      type,
      data: {
        root: type === 'app' ? `apps/${name}` : `libs/${name}`,
        tags: [],
      },
    };
  }

  private updateResponse() {
    const newProject = this.createNewProject();
    const libProjects = this.projectGraphsResponse.projects.filter(
      (project) => project.type === 'lib'
    );

    const targetDependency =
      libProjects[Math.floor(Math.random() * libProjects.length)];
    const newDependency: ProjectGraphDependency[] = [
      {
        source: newProject.name,
        target: targetDependency.name,
        type: 'static',
      },
    ];

    this.projectGraphsResponse = {
      ...this.projectGraphsResponse,
      projects: [...this.projectGraphsResponse.projects, newProject],
      dependencies: {
        ...this.projectGraphsResponse.dependencies,
        [newProject.name]: newDependency,
      },
    };
  }
}
