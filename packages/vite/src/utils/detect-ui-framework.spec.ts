import { createProjectGraphAsync, ProjectGraph } from '@nx/devkit';
import { detectUiFramework } from './detect-ui-framework';

jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  createProjectGraphAsync: jest.fn().mockImplementation(() => {
    throw new Error('createProjectGraphAsync stub is not configured');
  }),
}));

describe(detectUiFramework.name, () => {
  it.each([
    { framework: 'angular', dependency: '@angular/core' },
    { framework: 'angular', dependency: '@nx/angular' },
    { framework: 'react', dependency: 'react' },
    { framework: 'react', dependency: '@nx/react' },
    { framework: 'none', dependency: null },
  ])(
    `should detect $framework when dependency "$dependency" is present`,
    async ({ framework, dependency }) => {
      const { projectGraphFake } = setUp();

      if (dependency) {
        await projectGraphFake.addNpmDependency('my-project', dependency);
      }

      expect(await detectUiFramework('my-project')).toBe(framework);
    }
  );
});

function setUp() {
  const projectGraphFake = new ProjectGraphFake();
  (
    createProjectGraphAsync as jest.MockedFn<typeof createProjectGraphAsync>
  ).mockImplementation(async (options) =>
    projectGraphFake.createProjectGraphAsync(options)
  );

  return { projectGraphFake };
}

class ProjectGraphFake {
  private _graph: ProjectGraph = {
    dependencies: {},
    nodes: {},
  };

  async createProjectGraphAsync(
    opts: { exitOnError: boolean; resetDaemonClient?: boolean } = {
      exitOnError: false,
      resetDaemonClient: false,
    }
  ): Promise<ProjectGraph> {
    return this._graph;
  }

  async addNpmDependency(project: string, dependency: string) {
    this._graph.dependencies[project] ??= [];
    this._graph.dependencies[project].push({
      source: project,
      type: 'static',
      target: `npm:${dependency}`,
    });
  }
}
