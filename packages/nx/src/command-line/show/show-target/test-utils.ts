import type {
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../../../config/project-graph';
import type { ProjectConfiguration } from '../../../config/workspace-json-project-json';
import type { HashInputs } from '../../../native';

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

jest.mock('../../../project-graph/project-graph', () => ({
  ...(jest.requireActual(
    '../../../project-graph/project-graph'
  ) as typeof import('../../../project-graph/project-graph')),
  createProjectGraphAsync: jest
    .fn()
    .mockImplementation(() => Promise.resolve(graph)),
  createProjectGraphAndSourceMapsAsync: jest
    .fn()
    .mockImplementation(() =>
      Promise.resolve({ projectGraph: graph, sourceMaps: mockSourceMaps })
    ),
}));

jest.mock('../../../utils/workspace-root', () => ({
  workspaceRoot: '/workspace',
}));

jest.mock('../../../utils/output', () => ({
  output: {
    error: jest.fn(),
    drain: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../../config/configuration', () => ({
  readNxJson: jest.fn().mockImplementation(() => mockNxJson),
}));

jest.mock('../../../native', () => {
  const actual = jest.requireActual('../../../native');
  return {
    ...actual,
    expandOutputs: jest
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

jest.mock('../../../tasks-runner/utils', () => {
  const actual = jest.requireActual('../../../tasks-runner/utils');
  return {
    ...actual,
    getExecutorForTask: jest.fn().mockImplementation(() => ({
      hasherFactory: mockHasCustomHasher ? () => {} : null,
    })),
  };
});

jest.mock('../../../hasher/hash-plan-inspector', () => ({
  HashPlanInspector: jest.fn().mockImplementation(() => ({
    init: jest.fn().mockResolvedValue(undefined),
    inspectTaskInputs: jest.fn().mockImplementation(() => mockHashInputs),
  })),
}));

performance.mark = jest.fn();
performance.measure = jest.fn();

const originalCwd = process.cwd;

export function setupBeforeEach() {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);
  performance.mark('init-local');
  mockCwd = '/workspace';
  mockNxJson = {};
  mockHashInputs = {};
  mockExpandedOutputs = null;
  mockSourceMaps = {};
  mockHasCustomHasher = false;
  process.exitCode = undefined;
  process.cwd = jest.fn().mockReturnValue(mockCwd);
}

export function setupAfterEach() {
  jest.clearAllMocks();
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
