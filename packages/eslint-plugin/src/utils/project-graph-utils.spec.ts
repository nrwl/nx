import type { ProjectGraph } from '@nx/devkit';

const mocks = vi.hoisted(() => ({
  files: new Map<string, Buffer>(),
  isTerminalRun: vi.fn(() => false),
  readCachedProjectGraph: vi.fn(),
  readFileMapCache: vi.fn(),
  readNxJsonFromDisk: vi.fn(() => ({ workspaceLayout: { appsDir: 'a' } })),
  parseProjectGraphCache: vi.fn(),
  parseFileMapCache: vi.fn(),
  locator: vi.fn(),
}));

vi.mock('node:fs', async () => ({
  ...(await vi.importActual<any>('node:fs')),
  readFileSync: vi.fn((path: string) => {
    const file = mocks.files.get(path);
    if (!file) {
      throw Object.assign(new Error(`ENOENT: ${path}`), { code: 'ENOENT' });
    }
    return file;
  }),
}));

vi.mock('./runtime-lint-utils', () => ({
  isTerminalRun: mocks.isTerminalRun,
}));

vi.mock('@nx/devkit', async () => ({
  ...(await vi.importActual<any>('@nx/devkit')),
  readCachedProjectGraph: mocks.readCachedProjectGraph,
}));

vi.mock('@nx/devkit/internal', async () => {
  const actual = await vi.importActual<any>('@nx/devkit/internal');
  return {
    ...actual,
    nxProjectGraph: '/ws/project-graph.json',
    nxFileMap: '/ws/file-map.json',
    readFileMapCache: mocks.readFileMapCache,
    readNxJsonFromDisk: mocks.readNxJsonFromDisk,
    parseProjectGraphCache: mocks.parseProjectGraphCache.mockImplementation(
      actual.parseProjectGraphCache
    ),
    parseFileMapCache: mocks.parseFileMapCache.mockImplementation(
      actual.parseFileMapCache
    ),
  };
});

vi.mock('@nx/js/internal', () => ({
  TargetProjectLocator: class {
    constructor(...args: unknown[]) {
      mocks.locator(...args);
    }
  },
}));

import { readFileSync } from 'node:fs';
import {
  ensureGlobalProjectGraph,
  readProjectGraph,
} from './project-graph-utils';

const GRAPH_PATH = '/ws/project-graph.json';
const MAP_PATH = '/ws/file-map.json';

function graphJson(name: string) {
  return JSON.stringify({
    nodes: { [name]: { name, type: 'lib', data: { root: `libs/${name}` } } },
    dependencies: { [name]: [] },
  });
}

function mapJson(file: string) {
  return JSON.stringify({
    fileMap: { projectFileMap: { a: [{ file, hash: '1' }] } },
  });
}

function writeGraph(content: string) {
  mocks.files.set(GRAPH_PATH, Buffer.from(content));
}

function writeMap(content: string) {
  mocks.files.set(MAP_PATH, Buffer.from(content));
}

function clearGlobals() {
  for (const key of [
    'projectGraph',
    'projectRootMappings',
    'projectFileMap',
    'targetProjectLocator',
    'workspaceLayout',
  ]) {
    delete globalThis[key];
  }
}

describe('ensureGlobalProjectGraph', () => {
  let stdout: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mocks.files.clear();
    vi.clearAllMocks();
    mocks.isTerminalRun.mockReturnValue(false);
    clearGlobals();
    stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    // Drop the cache entry the previous test left in the module.
    writeGraph('{');
    ensureGlobalProjectGraph('rule');
    vi.clearAllMocks();
    mocks.files.clear();
  });

  afterEach(() => {
    stdout.mockRestore();
  });

  describe('outside a terminal run', () => {
    it('parses the same bytes once and reuses the values', () => {
      writeGraph(graphJson('a'));
      writeMap(mapJson('x.ts'));

      const first = readProjectGraph('rule');
      const second = readProjectGraph('rule');
      const third = readProjectGraph('rule');

      expect(mocks.parseProjectGraphCache).toHaveBeenCalledTimes(1);
      expect(mocks.parseFileMapCache).toHaveBeenCalledTimes(1);
      expect(second.projectGraph).toBe(first.projectGraph);
      expect(third.projectGraph).toBe(first.projectGraph);
      expect(third.projectRootMappings).toBe(first.projectRootMappings);
      expect(third.projectFileMap).toBe(first.projectFileMap);
      expect(first.projectFileMap).toEqual({
        a: [{ file: 'x.ts', hash: '1' }],
      });
      expect(second.targetProjectLocator).not.toBe(first.targetProjectLocator);
      expect(third.targetProjectLocator).not.toBe(second.targetProjectLocator);
      expect(mocks.locator).toHaveBeenCalledTimes(3);
      expect(mocks.readNxJsonFromDisk).toHaveBeenCalledTimes(3);
      expect(globalThis.workspaceLayout).toEqual({ appsDir: 'a' });
      expect(mocks.readCachedProjectGraph).not.toHaveBeenCalled();
      expect(mocks.readFileMapCache).not.toHaveBeenCalled();
    });

    it('parses only the graph again when only the graph bytes change', () => {
      writeGraph(graphJson('a'));
      writeMap(mapJson('x.ts'));
      const first = readProjectGraph('rule');

      writeGraph(graphJson('b'));
      const second = readProjectGraph('rule');

      expect(mocks.parseProjectGraphCache).toHaveBeenCalledTimes(2);
      expect(mocks.parseFileMapCache).toHaveBeenCalledTimes(1);
      expect(Object.keys(second.projectGraph.nodes)).toEqual(['b']);
      expect(second.projectRootMappings).not.toBe(first.projectRootMappings);
      expect(second.projectFileMap).toBe(first.projectFileMap);
    });

    it('parses only the file map again when only the file map bytes change', () => {
      writeGraph(graphJson('a'));
      writeMap(mapJson('x.ts'));
      const first = readProjectGraph('rule');

      writeMap(mapJson('y.ts'));
      const second = readProjectGraph('rule');

      expect(mocks.parseProjectGraphCache).toHaveBeenCalledTimes(1);
      expect(mocks.parseFileMapCache).toHaveBeenCalledTimes(2);
      expect(second.projectGraph).toBe(first.projectGraph);
      expect(second.projectFileMap).toEqual({
        a: [{ file: 'y.ts', hash: '1' }],
      });
    });

    it('parses the buffer that it keeps as the key', () => {
      const graph = graphJson('a');
      const map = mapJson('x.ts');
      writeGraph(graph);
      writeMap(map);

      readProjectGraph('rule');

      expect(mocks.parseProjectGraphCache).toHaveBeenCalledWith(graph);
      expect(mocks.parseFileMapCache).toHaveBeenCalledWith(map);
      expect(vi.mocked(readFileSync)).toHaveBeenCalledTimes(2);
    });

    it('returns the cached values when another plugin replaced the globals', () => {
      writeGraph(graphJson('a'));
      writeMap(mapJson('x.ts'));
      const first = readProjectGraph('rule');

      globalThis.projectGraph = { nodes: {}, dependencies: {} } as ProjectGraph;
      globalThis.projectFileMap = {};
      globalThis.projectRootMappings = new Map();
      const second = readProjectGraph('rule');

      expect(second.projectGraph).toBe(first.projectGraph);
      expect(second.projectFileMap).toBe(first.projectFileMap);
      expect(second.projectRootMappings).toBe(first.projectRootMappings);
    });

    it.each([
      ['the graph file is missing', () => writeMap(mapJson('x.ts'))],
      ['the file map is missing', () => writeGraph(graphJson('a'))],
      [
        'the graph is not valid JSON',
        () => {
          writeGraph('{');
          writeMap(mapJson('x.ts'));
        },
      ],
      [
        'the file map is null',
        () => {
          writeGraph(graphJson('a'));
          writeMap('null');
        },
      ],
      [
        'the graph has errors',
        () => {
          writeGraph(
            JSON.stringify({
              ...JSON.parse(graphJson('a')),
              errors: [{ message: 'x' }],
            })
          );
          writeMap(mapJson('x.ts'));
        },
      ],
    ])('warns, clears and retries when %s', (_, breakFiles) => {
      writeGraph(graphJson('a'));
      writeMap(mapJson('x.ts'));
      readProjectGraph('rule');

      mocks.files.clear();
      breakFiles();
      expect(readProjectGraph('rule')).toEqual({
        projectGraph: undefined,
        projectFileMap: undefined,
        projectRootMappings: undefined,
        targetProjectLocator: undefined,
      });
      readProjectGraph('rule');
      expect(stdout).toHaveBeenCalledTimes(2);
      expect(stdout.mock.calls[0][0]).toContain(
        'No cached ProjectGraph is available.'
      );
      expect(globalThis.workspaceLayout).toEqual({ appsDir: 'a' });

      writeGraph(graphJson('a'));
      writeMap(mapJson('x.ts'));
      const recovered = readProjectGraph('rule');
      expect(Object.keys(recovered.projectGraph.nodes)).toEqual(['a']);
      expect(recovered.projectFileMap).toEqual({
        a: [{ file: 'x.ts', hash: '1' }],
      });
      expect(stdout).toHaveBeenCalledTimes(2);
    });
  });

  describe('in a terminal run', () => {
    beforeEach(() => {
      mocks.isTerminalRun.mockReturnValue(true);
    });

    it('reuses warm globals without reading files', () => {
      globalThis.projectGraph = { nodes: {}, dependencies: {} } as ProjectGraph;
      globalThis.projectRootMappings = new Map();
      globalThis.projectFileMap = {};

      ensureGlobalProjectGraph('rule');

      expect(readFileSync).not.toHaveBeenCalled();
      expect(mocks.readNxJsonFromDisk).not.toHaveBeenCalled();
      expect(mocks.readCachedProjectGraph).not.toHaveBeenCalled();
    });

    it('loads cold globals with the existing readers', () => {
      const graph = JSON.parse(graphJson('a'));
      mocks.readCachedProjectGraph.mockReturnValue(graph);
      mocks.readFileMapCache.mockReturnValue({
        fileMap: { projectFileMap: { a: [] } },
      });

      ensureGlobalProjectGraph('rule');

      expect(globalThis.projectGraph).toBe(graph);
      expect(globalThis.projectFileMap).toEqual({ a: [] });
      expect(globalThis.projectRootMappings.get('libs/a')).toBe('a');
      expect(mocks.locator).toHaveBeenCalledTimes(1);
      expect(readFileSync).not.toHaveBeenCalled();
      expect(mocks.parseProjectGraphCache).not.toHaveBeenCalled();
    });
  });
});
