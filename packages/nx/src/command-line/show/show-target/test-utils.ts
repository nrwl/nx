import type {
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../../../config/project-graph';
import type { ProjectConfiguration } from '../../../config/workspace-json-project-json';
import type { HashInputs } from '../../../native';
import { _resetContextForTesting } from '../../../hasher/check-task-files';

export let graph: ProjectGraph = {
  nodes: {},
  dependencies: {},
  externalNodes: {},
};

export let mockCwd = '/workspace';
export let mockNxJson: Record<string, unknown> = {};
export let mockHashInputs: Record<string, HashInputs> = {};
export let mockExpandedOutputs: string[] | null = null;
export let mockSourceMaps: Record<
  string,
  Record<string, [string | null, string]>
> = {};

export function setGraph(g: ProjectGraph) {
  graph = g;
}
export function setMockCwd(cwd: string) {
  mockCwd = cwd;
}
export function setMockNxJson(nxJson: Record<string, unknown>) {
  mockNxJson = nxJson;
}
export function setMockHashInputs(inputs: Record<string, HashInputs>) {
  mockHashInputs = inputs;
}
export function setMockExpandedOutputs(outputs: string[] | null) {
  mockExpandedOutputs = outputs;
}
export function setMockSourceMaps(
  maps: Record<string, Record<string, [string | null, string]>>
) {
  mockSourceMaps = maps;
}

vi.mock('../../../project-graph/project-graph', async () => ({
  ...((await vi.importActual(
    '../../../project-graph/project-graph'
  )) as typeof import('../../../project-graph/project-graph')),
  createProjectGraphAsync: vi
    .fn()
    .mockImplementation(() => Promise.resolve(graph)),
  createProjectGraphAndSourceMapsAsync: vi
    .fn()
    .mockImplementation(() =>
      Promise.resolve({ projectGraph: graph, sourceMaps: mockSourceMaps })
    ),
}));

vi.mock('../../../utils/workspace-root', () => ({
  workspaceRoot: '/workspace',
}));

vi.mock('../../../utils/output', () => ({
  output: {
    error: vi.fn(),
    drain: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../../config/configuration', () => ({
  readNxJson: vi.fn().mockImplementation(() => mockNxJson),
}));

vi.mock('../../../native', async () => {
  const actual = await vi.importActual('../../../native');
  return {
    ...actual,
    expandOutputs: vi
      .fn()
      .mockImplementation((_root: string, outputs: string[]) => {
        if (mockExpandedOutputs !== null) return mockExpandedOutputs;
        return actual.expandOutputs(_root, outputs);
      }),
  };
});

export let mockHasCustomHasher = false;

export function setMockHasCustomHasher(value: boolean) {
  mockHasCustomHasher = value;
}

// hasCustomHasher lazy-requires tasks-runner/utils (CJS channel), which
// vi.mock cannot intercept; replace the module in the require channel too.
import { mockCjsModule } from '../../../internal-testing-utils/cjs-mock';
const mockGetExecutorForTask = vi.hoisted(() => vi.fn());
mockGetExecutorForTask.mockImplementation(() => ({
  hasherFactory: mockHasCustomHasher ? () => {} : null,
}));
mockCjsModule(import.meta.url, '../../../tasks-runner/utils', {
  ...require('../../../tasks-runner/utils'),
  getExecutorForTask: mockGetExecutorForTask,
});
vi.mock('../../../tasks-runner/utils', async () => {
  const actual = await vi.importActual('../../../tasks-runner/utils');
  return {
    ...actual,
    getExecutorForTask: mockGetExecutorForTask,
  };
});

vi.mock('../../../hasher/hash-plan-inspector', () => ({
  // A plain function so `new HashPlanInspector(...)` works (arrows are not
  // constructible under vitest's mocks).
  HashPlanInspector: vi.fn().mockImplementation(function () {
    return {
      init: vi.fn().mockResolvedValue(undefined),
      inspectTaskInputs: vi.fn().mockImplementation(() => mockHashInputs),
    };
  }),
}));

performance.mark = vi.fn();
performance.measure = vi.fn();

const originalCwd = process.cwd;

export function setupBeforeEach() {
  // Reset the module-level context cache in check-task-files so each test
  // loads a fresh project graph and HashPlanInspector instance.
  _resetContextForTesting();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
  performance.mark('init-local');
  mockCwd = '/workspace';
  mockNxJson = {};
  mockHashInputs = {};
  mockExpandedOutputs = null;
  mockSourceMaps = {};
  mockHasCustomHasher = false;
  process.exitCode = undefined;
  process.cwd = vi.fn().mockReturnValue(mockCwd);
}

export function setupAfterEach() {
  vi.clearAllMocks();
  process.cwd = originalCwd;
}

export class GraphBuilder {
  nodes: Record<string, ProjectGraphProjectNode> = {};
  dependencies: Record<
    string,
    { type: string; source: string; target: string }[]
  > = {};

  addProjectConfiguration(
    project: ProjectConfiguration & { name: string },
    type: ProjectGraph['nodes'][string]['type']
  ) {
    this.nodes[project.name] = {
      name: project.name,
      type,
      data: { ...project },
    };
    if (!this.dependencies[project.name]) {
      this.dependencies[project.name] = [];
    }
    return this;
  }

  addDependency(source: string, target: string) {
    if (!this.dependencies[source]) {
      this.dependencies[source] = [];
    }
    this.dependencies[source].push({
      type: 'static',
      source,
      target,
    });
    return this;
  }

  build(): ProjectGraph {
    return {
      nodes: this.nodes,
      dependencies: this.dependencies,
      externalNodes: {},
    };
  }
}
