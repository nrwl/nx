import type { FileData } from '../../config/project-graph';
import { HashPlanner } from '../../native';
import { createProjectGraphAsync } from '../../project-graph/project-graph';
import { createTaskGraph } from '../../tasks-runner/create-task-graph';
import { allFileData } from '../../utils/all-file-data';
import { getExpandedTaskInputs, ProjectGraphClientResponse } from './graph';

jest.mock('../../native', () => ({
  HashPlanner: jest.fn(),
  transferProjectGraph: jest.fn((g) => g),
}));
jest.mock('../../native/transform-objects', () => ({
  transformProjectGraphForRust: jest.fn((g) => g),
}));
jest.mock('../../project-graph/project-graph', () => ({
  createProjectGraphAsync: jest.fn(),
  createProjectGraphAndSourceMapsAsync: jest.fn(),
  handleProjectGraphError: jest.fn(),
}));
jest.mock('../../config/configuration', () => ({
  readNxJson: jest.fn(() => ({})),
  workspaceLayout: jest.fn(() => ({ appsDir: '', libsDir: '' })),
}));
jest.mock('../../tasks-runner/create-task-graph', () => ({
  createTaskGraph: jest.fn(),
}));
jest.mock('../../utils/all-file-data', () => ({
  allFileData: jest.fn(),
}));

const createProjectGraphAsyncMock = createProjectGraphAsync as jest.Mock;
const createTaskGraphMock = createTaskGraph as jest.Mock;
const allFileDataMock = allFileData as jest.Mock;
const HashPlannerMock = HashPlanner as unknown as jest.Mock;

describe('getExpandedTaskInputs', () => {
  let getPlansMock: jest.Mock;

  // A workspace with a single project `myproj` that has a `build` target and a
  // `test:integration` target (whose name contains a colon).
  function makeResponse(
    overrides: Partial<ProjectGraphClientResponse> = {}
  ): ProjectGraphClientResponse {
    return {
      hash: 'hash',
      projects: [
        {
          name: 'myproj',
          type: 'lib',
          data: {
            root: 'libs/myproj',
            targets: { build: {}, 'test:integration': {} },
          },
        } as any,
      ],
      dependencies: {},
      fileMap: {
        myproj: [
          { file: 'libs/myproj/src/index.ts', hash: 'a' },
          { file: 'libs/myproj/project.json', hash: 'b' },
        ],
      },
      layout: { appsDir: '', libsDir: '' },
      affected: [],
      focus: null,
      groupByFolder: false,
      exclude: [],
      isPartial: false,
      errors: [],
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();

    getPlansMock = jest.fn().mockReturnValue({});
    HashPlannerMock.mockImplementation(() => ({ getPlans: getPlansMock }));

    createProjectGraphAsyncMock.mockResolvedValue({
      nodes: {},
      dependencies: {},
    });

    // By default the task graph contains the requested task so a plan is
    // produced. Individual tests override the returned plan.
    createTaskGraphMock.mockImplementation(
      (_graph, _overrides, projects, targets) => ({
        tasks: { [`${projects[0]}:${targets[0]}`]: {} },
        dependencies: {},
        continuousDependencies: {},
        roots: [],
      })
    );

    allFileDataMock.mockResolvedValue([] as FileData[]);
  });

  it('returns the cached value without recomputing when the task is already cached', async () => {
    const cache = new Map<string, Record<string, string[]>>();
    const cached = { general: ['already-cached.ts'] };
    cache.set('myproj:build', cached);

    const result = await getExpandedTaskInputs(
      makeResponse(),
      cache,
      'myproj:build'
    );

    // Exact same object reference is handed back
    expect(result).toBe(cached);
    // None of the expensive downstream work ran
    expect(createProjectGraphAsyncMock).not.toHaveBeenCalled();
    expect(createTaskGraphMock).not.toHaveBeenCalled();
    expect(allFileDataMock).not.toHaveBeenCalled();
    expect(getPlansMock).not.toHaveBeenCalled();
  });

  it('caches and returns an empty object when the task has no plan', async () => {
    // Task graph has no tasks -> no plan is generated for the task id
    createTaskGraphMock.mockReturnValue({
      tasks: {},
      dependencies: {},
      continuousDependencies: {},
      roots: [],
    });

    const cache = new Map<string, Record<string, string[]>>();
    const result = await getExpandedTaskInputs(
      makeResponse(),
      cache,
      'myproj:build'
    );

    expect(result).toEqual({});
    // The empty result is still cached so we don't recompute next time
    expect(cache.get('myproj:build')).toBe(result);
    // With no task ids there is no need to ask the planner for plans
    expect(getPlansMock).not.toHaveBeenCalled();
  });

  it('expands workspace root, project root, other and external inputs', async () => {
    getPlansMock.mockReturnValue({
      'myproj:build': [
        // grouped workspace inputs: exact file + top-level glob
        'workspace:[{workspaceRoot}/package.json,{workspaceRoot}/*.md]',
        // project root fileset
        'myproj:{projectRoot}/src/**/*',
        // "other" named input
        'ProjectConfiguration',
        // external dependency (has a modifier prefix)
        'npm:some-pkg',
      ],
    });

    allFileDataMock.mockResolvedValue([
      { file: 'package.json', hash: '1' },
      { file: 'readme.md', hash: '2' },
      // nested markdown must NOT match the top-level `*.md` glob
      { file: 'docs/guide.md', hash: '3' },
    ] as FileData[]);

    const cache = new Map<string, Record<string, string[]>>();
    const result = await getExpandedTaskInputs(
      makeResponse(),
      cache,
      'myproj:build'
    );

    expect(result).toEqual({
      // workspace roots are sorted, then the ProjectConfiguration file is appended
      general: ['package.json', 'readme.md', 'libs/myproj/project.json'],
      // project root glob only matches files under libs/myproj/src
      myproj: ['libs/myproj/src/index.ts'],
      external: ['npm:some-pkg'],
    });
    // and the same result is stored in the cache
    expect(cache.get('myproj:build')).toBe(result);
  });

  it('memoizes: a second call for the same task reuses the cached result', async () => {
    getPlansMock.mockReturnValue({
      'myproj:build': ['npm:some-pkg'],
    });

    const cache = new Map<string, Record<string, string[]>>();
    const response = makeResponse();

    const first = await getExpandedTaskInputs(response, cache, 'myproj:build');
    const second = await getExpandedTaskInputs(response, cache, 'myproj:build');

    expect(second).toBe(first);
    // The heavy work happened exactly once
    expect(createProjectGraphAsyncMock).toHaveBeenCalledTimes(1);
    expect(getPlansMock).toHaveBeenCalledTimes(1);
    expect(allFileDataMock).toHaveBeenCalledTimes(1);
  });

  it('splits a task id whose target name contains a colon using the project nodes', async () => {
    getPlansMock.mockReturnValue({
      'myproj:test:integration': ['npm:some-pkg'],
    });

    const cache = new Map<string, Record<string, string[]>>();
    const result = await getExpandedTaskInputs(
      makeResponse(),
      cache,
      'myproj:test:integration'
    );

    // "test:integration" is parsed as the target (not target + configuration)
    const [, , projectsArg, targetsArg] = createTaskGraphMock.mock.calls[0];
    expect(projectsArg).toEqual(['myproj']);
    expect(targetsArg).toEqual(['test:integration']);

    expect(result).toEqual({ general: [], external: ['npm:some-pkg'] });
    expect(cache.get('myproj:test:integration')).toBe(result);
  });
});
