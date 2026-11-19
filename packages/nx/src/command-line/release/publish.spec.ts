import type { ProjectGraph } from '../../config/project-graph';
import type { ReleaseGroupWithName } from './config/filter-release-groups';
import { createAPI } from './publish';
import type { ReleaseGraph } from './utils/release-graph';

vi.mock('../../project-graph/project-graph', () => ({
  createProjectGraphAsync: vi.fn(),
}));

vi.mock('../../project-graph/file-map-utils', () => ({
  createProjectFileMapUsingProjectGraph: vi.fn(() => Promise.resolve({})),
}));

vi.mock('../../config/nx-json', async () => ({
  ...(await vi.importActual('../../config/nx-json')),
  readNxJson: vi.fn(() => ({})),
}));

vi.mock('./config/config', async () => ({
  ...(await vi.importActual('./config/config')),
  createNxReleaseConfig: vi.fn(() =>
    Promise.resolve({ error: null, nxReleaseConfig: {} })
  ),
}));

vi.mock('./utils/release-graph', () => ({
  createReleaseGraph: vi.fn(),
}));

vi.mock('../../project-graph/plugins/tasks-execution-hooks', () => ({
  runPreTasksExecution: vi.fn(),
  runPostTasksExecution: vi.fn(),
}));

vi.mock('../../tasks-runner/run-command', () => ({
  selectTasksForProjects: vi.fn((_graph, projectNames: string[]) =>
    projectNames.map((project) => ({ target: { project } }))
  ),
  runTasksForCommand: vi.fn((tasks: { target: { project: string } }[]) =>
    Promise.resolve({
      taskResults: Object.fromEntries(
        tasks.map((task) => [task.target.project, { task, code: 0 }])
      ),
    })
  ),
}));

const { createProjectGraphAsync } =
  await import('../../project-graph/project-graph');
const { createReleaseGraph } = await import('./utils/release-graph');
const { selectTasksForProjects } =
  await import('../../tasks-runner/run-command');

function project(name: string, publishable = true) {
  return {
    name,
    type: 'lib' as const,
    data: {
      root: `packages/${name}`,
      targets: publishable ? { 'nx-release-publish': {} } : {},
    },
  };
}

function group(
  name: string,
  projects: string[],
  projectsRelationship: 'fixed' | 'independent' = 'independent'
) {
  return { name, projects, projectsRelationship } as ReleaseGroupWithName;
}

function releaseGraphFor(
  groups: { group: ReleaseGroupWithName; filtered: string[] }[],
  addedForDependents: string[] = []
) {
  return {
    releaseGroups: groups.map(({ group }) => group),
    sortedReleaseGroups: groups.map(({ group }) => group.name),
    releaseGroupToFilteredProjects: new Map(
      groups.map(({ group, filtered }) => [group, new Set(filtered)])
    ),
    releaseGroupsAddedForDependents: new Set(addedForDependents),
    filterLog: null,
  } as unknown as ReleaseGraph;
}

function publishedProjects(): string[][] {
  return vi.mocked(selectTasksForProjects).mock.calls.map((call) => call[1]);
}

describe('releasePublish', () => {
  const releasePublish = createAPI({}, false);
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NX_RELEASE_INTERNAL_SUPPRESS_FILTER_LOG = 'true';
    vi.mocked(createProjectGraphAsync).mockResolvedValue({
      nodes: {
        a: project('a'),
        b: project('b'),
        c: project('c'),
        e: project('e'),
        'app-1': project('app-1', false),
        'app-2': project('app-2', false),
      },
      dependencies: {},
    } as unknown as ProjectGraph);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // group-a = [a, c] is selected, group-b = [b, e] is only in scope because b depends on c
  const groupA = group('group-a', ['a', 'c']);
  const groupB = group('group-b', ['b', 'e']);

  it('should publish only the dependents selected from a group pulled in by updateDependents', async () => {
    const result = await releasePublish({
      groups: ['group-a'],
      releaseGraph: releaseGraphFor(
        [
          { group: groupA, filtered: ['a', 'c'] },
          { group: groupB, filtered: ['b'] },
        ],
        ['group-b']
      ),
    });

    expect(publishedProjects()).toEqual([['a', 'c'], ['b']]);
    expect(Object.keys(result)).toEqual(['a', 'c', 'b']);
  });

  it('should build its own release graph with the filters when none is passed in', async () => {
    vi.mocked(createReleaseGraph).mockResolvedValue(
      releaseGraphFor(
        [
          { group: groupA, filtered: ['a', 'c'] },
          { group: groupB, filtered: ['b'] },
        ],
        ['group-b']
      )
    );

    await releasePublish({ groups: ['group-a'] });

    expect(createReleaseGraph).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: { projects: undefined, groups: ['group-a'] },
      })
    );
    expect(publishedProjects()).toEqual([['a', 'c'], ['b']]);
  });

  it('should still publish every member of a fixed group pulled in by updateDependents', async () => {
    const fixedGroupB = group('group-b', ['b', 'e'], 'fixed');

    await releasePublish({
      groups: ['group-a'],
      releaseGraph: releaseGraphFor(
        [
          { group: groupA, filtered: ['a', 'c'] },
          { group: fixedGroupB, filtered: ['b'] },
        ],
        ['group-b']
      ),
    });

    expect(publishedProjects()).toEqual([
      ['a', 'c'],
      ['b', 'e'],
    ]);
  });

  it('should publish the filtered projects of each group when filtering by projects', async () => {
    await releasePublish({
      projects: ['c'],
      releaseGraph: releaseGraphFor(
        [
          { group: groupA, filtered: ['c'] },
          { group: groupB, filtered: ['b'] },
        ],
        ['group-b']
      ),
    });

    expect(publishedProjects()).toEqual([['c'], ['b']]);
  });

  it('should publish every project of every group when no filter is applied', async () => {
    await releasePublish({
      releaseGraph: releaseGraphFor([
        { group: groupA, filtered: ['a', 'c'] },
        { group: groupB, filtered: ['b', 'e'] },
      ]),
    });

    expect(publishedProjects()).toEqual([
      ['a', 'c'],
      ['b', 'e'],
    ]);
  });
});
