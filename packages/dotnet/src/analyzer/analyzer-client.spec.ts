import { EventEmitter } from 'node:events';

jest.mock('node:fs', () => ({
  ...jest.requireActual('node:fs'),
  existsSync: jest.fn(() => true),
}));

const mocks = {
  safeSpawn: jest.fn(),
  killChildOnHostExit: jest.fn(),
  killProcessTreeGraceful: jest.fn(() => Promise.resolve()),
  pluginCacheGet: jest.fn(() => undefined),
};

jest.mock('@nx/devkit/internal', () => ({
  ...jest.requireActual('@nx/devkit/internal'),
  isCI: () => false,
  hashWithWorkspaceContext: jest.fn(async () => 'files-hash'),
  hashObject: () => 'options-hash',
  workspaceDataDirectory: '/tmp/workspace-data',
  PluginCache: jest.fn(() => ({
    get: mocks.pluginCacheGet,
    set: jest.fn(),
    writeToDisk: jest.fn(),
  })),
  safeSpawn: (...args: unknown[]) => mocks.safeSpawn(...args),
  killChildOnHostExit: (...args: unknown[]) =>
    mocks.killChildOnHostExit(...args),
  killProcessTreeGraceful: (...args: unknown[]) =>
    mocks.killProcessTreeGraceful(...args),
}));

function fakeChild(pid = 123) {
  const child: any = new EventEmitter();
  child.pid = pid;
  child.stdout = new EventEmitter();
  child.stdout.setEncoding = jest.fn();
  child.stderr = new EventEmitter();
  child.stderr.setEncoding = jest.fn();
  child.stdin = new EventEmitter();
  child.stdin.end = jest.fn();
  return child;
}

describe('analyzeProjects', () => {
  let analyzeProjects: typeof import('./analyzer-client').analyzeProjects;
  let getAnalysisTimeoutMs: typeof import('./analyzer-client').getAnalysisTimeoutMs;
  let readCachedAnalysisResult: typeof import('./analyzer-client').readCachedAnalysisResult;
  let ANALYZER_CANCELLED_MESSAGE: string;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete process.env.NX_DOTNET_PROJECT_GRAPH_TIMEOUT;
    ({
      analyzeProjects,
      getAnalysisTimeoutMs,
      readCachedAnalysisResult,
      ANALYZER_CANCELLED_MESSAGE,
    } = require('./analyzer-client'));
  });

  it('should stream the options then the file list over stdin and parse stdout', async () => {
    const child = fakeChild();
    mocks.safeSpawn.mockReturnValue(child);

    const promise = analyzeProjects(['a/a.csproj', 'b/b.csproj'], {
      buildTargetName: 'build',
    });
    await new Promise(setImmediate);
    child.stdout.emit(
      'data',
      JSON.stringify({
        nodesByFile: { 'a/a.csproj': {} },
        referencesByRoot: {},
      })
    );
    child.emit('close', 0);

    await expect(promise).resolves.toEqual({
      nodesByFile: { 'a/a.csproj': {} },
      referencesByRoot: {},
    });
    expect(child.stdin.end).toHaveBeenCalledWith(
      `${JSON.stringify({
        buildTargetName: 'build',
      })}\na/a.csproj\nb/b.csproj`
    );
    // The options must NOT be in argv: a double quote there is refused by cmd.exe
    // quoting on Windows, which is what `safeSpawn` applies to a bare binary name.
    const [binary, args] = mocks.safeSpawn.mock.calls[0];
    expect(binary).toBe('dotnet');
    expect(args).toHaveLength(2);
    expect(args.some((a: string) => a.includes('"'))).toBe(false);
  });

  it('should write an empty options line when no options are given', async () => {
    const child = fakeChild();
    mocks.safeSpawn.mockReturnValue(child);

    const promise = analyzeProjects(['a/a.csproj']);
    await new Promise(setImmediate);
    child.stdout.emit('data', '{"nodesByFile":{},"referencesByRoot":{}}');
    child.emit('close', 0);
    await promise;

    expect(child.stdin.end).toHaveBeenCalledWith('\na/a.csproj');
  });

  it('should register the analyzer process to be killed on host exit', async () => {
    const child = fakeChild();
    mocks.safeSpawn.mockReturnValue(child);

    const promise = analyzeProjects(['a/a.csproj']);
    await new Promise(setImmediate);
    child.stdout.emit('data', '{"nodesByFile":{},"referencesByRoot":{}}');
    child.emit('close', 0);
    await promise;

    expect(mocks.killChildOnHostExit).toHaveBeenCalledWith(child);
  });

  it('should return an error result when the analyzer exits non-zero', async () => {
    const child = fakeChild();
    mocks.safeSpawn.mockReturnValue(child);

    const promise = analyzeProjects(['a/a.csproj']);
    await new Promise(setImmediate);
    child.stderr.emit('data', 'boom');
    child.emit('close', 1);

    const result = await promise;
    expect('error' in result && result.error.message).toMatch(
      /exited with code 1: boom/
    );
  });

  it('should kill the analyzer and fail with a timeout error when it hangs', async () => {
    jest.useFakeTimers();
    try {
      process.env.NX_DOTNET_PROJECT_GRAPH_TIMEOUT = '1';
      const child = fakeChild(456);
      mocks.safeSpawn.mockReturnValue(child);

      const promise = analyzeProjects(['a/a.csproj']);
      await jest.advanceTimersByTimeAsync(1000);

      const result = await promise;
      expect('error' in result && result.error.message).toMatch(
        /timed out after 1 second/
      );
      expect(mocks.killProcessTreeGraceful).toHaveBeenCalledWith(456);
    } finally {
      jest.useRealTimers();
    }
  });

  // setTimeout clamps a delay past the 32-bit signed max to 1ms, so an
  // unclamped huge value would abort the analyzer instantly — the opposite of
  // what the timeout error tells the user to do.
  it('should clamp an overflowing NX_DOTNET_PROJECT_GRAPH_TIMEOUT instead of inverting it', () => {
    process.env.NX_DOTNET_PROJECT_GRAPH_TIMEOUT = '9999999';
    const ms = getAnalysisTimeoutMs();
    expect(ms).toBe(2 ** 31 - 1);
    expect(ms).toBeLessThanOrEqual(2 ** 31 - 1);
    expect(ms).toBeGreaterThan(120_000);
  });

  it('should parse malformed analyzer output into an attributable error', async () => {
    const child = fakeChild();
    mocks.safeSpawn.mockReturnValue(child);

    const promise = analyzeProjects(['a/a.csproj']);
    await new Promise(setImmediate);
    child.stdout.emit('data', 'not json at all');
    child.emit('close', 0);

    const result = await promise;
    expect('error' in result && result.error.message).toMatch(
      /Failed to parse msbuild-analyzer output/
    );
  });

  // A superseded run must not poison the cache: createDependencies reads that
  // cache, so a stored sentinel would surface as a user-facing failure later.
  it('should not cache a cancelled run', async () => {
    const first = fakeChild(1);
    const second = fakeChild(2);
    mocks.safeSpawn.mockReturnValueOnce(first).mockReturnValueOnce(second);

    const firstRun = analyzeProjects(['a/a.csproj']);
    await new Promise(setImmediate);

    // A newer analysis supersedes the first one.
    const secondRun = analyzeProjects(['a/a.csproj', 'b/b.csproj']);
    await new Promise(setImmediate);

    const firstResult = await firstRun;
    expect('error' in firstResult && firstResult.error.message).toBe(
      ANALYZER_CANCELLED_MESSAGE
    );

    // Assert BEFORE the second run settles: once it succeeds it overwrites the
    // cache, which would mask a cached sentinel and make this test vacuous.
    expect(() => readCachedAnalysisResult()).toThrow(/cache is empty/);

    second.stdout.emit('data', '{"nodesByFile":{},"referencesByRoot":{}}');
    second.emit('close', 0);
    await secondRun;

    expect(readCachedAnalysisResult()).toEqual({
      nodesByFile: {},
      referencesByRoot: {},
    });
  });

  it('should read the timeout from NX_DOTNET_PROJECT_GRAPH_TIMEOUT in seconds', () => {
    expect(getAnalysisTimeoutMs()).toBe(120_000);
    process.env.NX_DOTNET_PROJECT_GRAPH_TIMEOUT = 'Infinity';
    expect(getAnalysisTimeoutMs()).toBe(2 ** 31 - 1);

    process.env.NX_DOTNET_PROJECT_GRAPH_TIMEOUT = '30';
    expect(getAnalysisTimeoutMs()).toBe(30_000);
    process.env.NX_DOTNET_PROJECT_GRAPH_TIMEOUT = 'nope';
    expect(getAnalysisTimeoutMs()).toBe(120_000);
  });
});
