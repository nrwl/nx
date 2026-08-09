import { readCachedProjectGraph } from '@nx/devkit';
import { statSync } from 'node:fs';
import { isTerminalRun } from './runtime-lint-utils';
import { readProjectGraph } from './project-graph-utils';

jest.mock('@nx/devkit', () => ({
  readCachedProjectGraph: jest.fn(),
  workspaceRoot: '/root',
}));

jest.mock('@nx/devkit/internal', () => ({
  createProjectRootMappings: jest.fn(),
  readNxJsonFromDisk: jest.fn(),
  readFileMapCache: jest.fn(),
  nxProjectGraph: '/root/.nx/workspace-data/project-graph.json',
  nxFileMap: '/root/.nx/workspace-data/file-map.json',
}));

jest.mock('@nx/js/internal', () => ({
  TargetProjectLocator: jest.fn(),
}));

jest.mock('./runtime-lint-utils', () => ({
  isTerminalRun: jest.fn(),
}));

jest.mock('node:fs', () => ({
  ...jest.requireActual('node:fs'),
  statSync: jest.fn(),
}));

const mockReadCachedProjectGraph = readCachedProjectGraph as jest.Mock;
const mockIsTerminalRun = isTerminalRun as jest.Mock;
const mockStatSync = statSync as unknown as jest.Mock;
const { createProjectRootMappings, readNxJsonFromDisk, readFileMapCache } =
  jest.requireMock('@nx/devkit/internal');

const GRAPH_FILE = '/root/.nx/workspace-data/project-graph.json';
const FILE_MAP_FILE = '/root/.nx/workspace-data/file-map.json';
const NX_JSON_FILE = '/root/nx.json';

describe('readProjectGraph', () => {
  let fileStats: Record<string, { mtimeMs: number; size: number } | undefined>;
  let stdoutSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    for (const key of [
      'projectGraph',
      'projectRootMappings',
      'projectFileMap',
      'targetProjectLocator',
      'projectGraphFingerprint',
      'workspaceLayout',
    ]) {
      delete (globalThis as any)[key];
    }

    fileStats = {
      [GRAPH_FILE]: { mtimeMs: 100, size: 1000 },
      [FILE_MAP_FILE]: { mtimeMs: 100, size: 2000 },
      [NX_JSON_FILE]: { mtimeMs: 50, size: 300 },
    };
    mockStatSync.mockImplementation((path: string) => fileStats[path]);
    mockIsTerminalRun.mockReturnValue(false);
    mockReadCachedProjectGraph.mockReturnValue({
      nodes: {},
      externalNodes: {},
      dependencies: {},
    });
    readNxJsonFromDisk.mockReturnValue({
      workspaceLayout: { appsDir: 'apps', libsDir: 'libs' },
    });
    readFileMapCache.mockReturnValue({ fileMap: { projectFileMap: {} } });
    createProjectRootMappings.mockReturnValue(new Map());
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockReturnValue(true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
  });

  it('should load the project graph on first invocation', () => {
    const result = readProjectGraph('enforce-module-boundaries');

    expect(mockReadCachedProjectGraph).toHaveBeenCalledTimes(1);
    expect(result.projectGraph).toBeDefined();
    expect(result.projectRootMappings).toBeDefined();
    expect(result.projectFileMap).toBeDefined();
    expect(result.targetProjectLocator).toBeDefined();
  });

  it('should reuse the cached graph without re-reading it during terminal runs', () => {
    mockIsTerminalRun.mockReturnValue(true);

    readProjectGraph('enforce-module-boundaries');
    const statCallsAfterFirstRun = mockStatSync.mock.calls.length;
    readProjectGraph('enforce-module-boundaries');

    expect(mockReadCachedProjectGraph).toHaveBeenCalledTimes(1);
    expect(mockStatSync.mock.calls.length).toBe(statCallsAfterFirstRun);
  });

  it('should reuse the cached graph while cache files are unchanged outside terminal runs', () => {
    readProjectGraph('enforce-module-boundaries');
    readProjectGraph('enforce-module-boundaries');
    readProjectGraph('enforce-module-boundaries');

    expect(mockReadCachedProjectGraph).toHaveBeenCalledTimes(1);
  });

  it('should reload the graph when a cache file changes outside terminal runs', () => {
    readProjectGraph('enforce-module-boundaries');

    fileStats[GRAPH_FILE] = { mtimeMs: 200, size: 1024 };
    readProjectGraph('enforce-module-boundaries');
    expect(mockReadCachedProjectGraph).toHaveBeenCalledTimes(2);

    readProjectGraph('enforce-module-boundaries');
    expect(mockReadCachedProjectGraph).toHaveBeenCalledTimes(2);
  });

  it('should reload the graph when nx.json changes outside terminal runs', () => {
    readProjectGraph('enforce-module-boundaries');

    fileStats[NX_JSON_FILE] = { mtimeMs: 51, size: 305 };
    readProjectGraph('enforce-module-boundaries');

    expect(mockReadCachedProjectGraph).toHaveBeenCalledTimes(2);
  });

  it('should warn and retry on the next invocation when no cached graph is available', () => {
    fileStats = {};
    mockReadCachedProjectGraph.mockImplementation(() => {
      throw new Error('No cached ProjectGraph is available');
    });

    const result = readProjectGraph('enforce-module-boundaries');
    expect(result.projectGraph).toBeUndefined();
    expect(stdoutSpy).toHaveBeenCalledWith(
      expect.stringContaining('No cached ProjectGraph is available')
    );

    readProjectGraph('enforce-module-boundaries');
    expect(mockReadCachedProjectGraph).toHaveBeenCalledTimes(2);
  });
});
