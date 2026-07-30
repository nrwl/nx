/**
 * Tests for the analyzer's caching layer.
 *
 * The cache is keyed on the hash of project files, but atomized test targets are
 * derived from C# sources. Without a second level of invalidation, adding a test
 * class leaves the cached analysis in place and the new test never gets a
 * target. A workspace where nothing atomizes must not hash sources at all, since
 * that would re-run MSBuild evaluation on every .cs edit.
 */

import { EventEmitter } from 'node:events';

jest.mock('node:fs', () => ({
  ...jest.requireActual('node:fs'),
  existsSync: jest.fn(() => true),
}));

const hashWithWorkspaceContext = jest.fn<Promise<string>, [string, string[]]>();

// One entry store per cache-file path, because the real PluginCache writes to a
// per-options filename and tests need to tell those apart.
let pluginCacheStores: Record<string, Record<string, unknown>> = {};
// Entries visible to every path, for seeding a value whose owning path a test
// cannot predict (the options hash is computed internally).
let seededEntries: Record<string, unknown> = {};

const mocks = {
  safeSpawn: jest.fn(),
  killChildOnHostExit: jest.fn(),
  killProcessTreeGraceful: jest.fn(() => Promise.resolve()),
};

jest.mock('@nx/devkit/internal', () => ({
  ...jest.requireActual('@nx/devkit/internal'),
  isCI: () => false,
  hashWithWorkspaceContext: (root: string, globs: string[]) =>
    hashWithWorkspaceContext(root, globs),
  // Derived from the options so a different registration lands on a different
  // cache file, which is what the real per-options filename does.
  hashObject: (options: unknown) => JSON.stringify(options ?? null),
  workspaceDataDirectory: '/tmp/workspace-data',
  PluginCache: class {
    private store: Record<string, unknown>;
    constructor(cachePath: string) {
      this.store = pluginCacheStores[cachePath] ??= {};
    }
    get(key: string) {
      return this.store[key] ?? seededEntries[key];
    }
    set(key: string, value: unknown) {
      this.store[key] = value;
    }
    has(key: string) {
      return key in this.store || key in seededEntries;
    }
    writeToDisk() {}
  },
  safeSpawn: (...args: unknown[]) => mocks.safeSpawn(...args),
  killChildOnHostExit: (...args: unknown[]) =>
    mocks.killChildOnHostExit(...args),
  killProcessTreeGraceful: (...args: unknown[]) =>
    mocks.killProcessTreeGraceful(...args),
}));

jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  workspaceRoot: '/ws',
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
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
    pluginCacheStores = {};
    seededEntries = {};
    hashWithWorkspaceContext.mockImplementation(async (_root, globs) =>
      globs.join('|')
    );
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

describe('analyzer-client caching', () => {
  let analyzeProjects: typeof import('./analyzer-client').analyzeProjects;
  let clearCache: typeof import('./analyzer-client').clearCache;

  const PROJECT_FILES = ['apps/it/it.csproj'];

  const EMPTY_ANALYSIS = { nodesByFile: {}, referencesByRoot: {} };
  const ATOMIZED_ANALYSIS = {
    ...EMPTY_ANALYSIS,
    atomizedRoots: ['apps/it'],
  };

  /** Makes the spawned analyzer return `payload` as its stdout. */
  function analyzerReturns(payload: Record<string, unknown>) {
    mocks.safeSpawn.mockImplementation(() => {
      const child = fakeChild();
      setImmediate(() => {
        child.stdout.emit('data', JSON.stringify(payload));
        child.emit('close', 0);
      });
      return child;
    });
  }

  /** Makes the spawned analyzer fail with `stderr` and a non-zero exit. */
  function analyzerFails(stderr: string) {
    mocks.safeSpawn.mockImplementation(() => {
      const child = fakeChild();
      setImmediate(() => {
        child.stderr.emit('data', stderr);
        child.emit('close', 1);
      });
      return child;
    });
  }

  /** Glob groups passed to the hasher, in call order. */
  const hashedGlobs = () =>
    hashWithWorkspaceContext.mock.calls.map(([, g]) => g);

  /** How many times the analyzer was actually spawned. */
  const spawnCount = () => mocks.safeSpawn.mock.calls.length;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    pluginCacheStores = {};
    seededEntries = {};
    // Default: every hash request is distinct-but-stable per glob group.
    hashWithWorkspaceContext.mockImplementation(async (_root, globs) =>
      globs.join('|')
    );
    ({ analyzeProjects, clearCache } = require('./analyzer-client'));
  });

  describe('when nothing atomizes', () => {
    it('hashes only the project files, never the sources', async () => {
      analyzerReturns(EMPTY_ANALYSIS);

      await analyzeProjects(PROJECT_FILES);

      // One hash call, for the project files: workspaces that do not opt in
      // pay nothing.
      expect(hashedGlobs()).toEqual([PROJECT_FILES]);
    });

    it('serves the cached result without re-hashing sources', async () => {
      analyzerReturns(EMPTY_ANALYSIS);
      await analyzeProjects(PROJECT_FILES);
      const callsAfterFirstRun = hashWithWorkspaceContext.mock.calls.length;

      clearCache(); // force the on-disk cache path rather than the in-memory one
      await analyzeProjects(PROJECT_FILES);

      // One more call for the project-files hash, and nothing else.
      expect(hashWithWorkspaceContext.mock.calls.length).toBe(
        callsAfterFirstRun + 1
      );
      expect(spawnCount()).toBe(1);
    });
  });

  describe('when a project atomizes', () => {
    it('additionally hashes that project root’s C# sources', async () => {
      analyzerReturns(ATOMIZED_ANALYSIS);

      await analyzeProjects(PROJECT_FILES);

      expect(hashedGlobs()).toEqual([PROJECT_FILES, ['apps/it/**/*.cs']]);
    });

    it('puts every atomized root in a single glob group', async () => {
      // Grouping per root would make the native hasher walk the full file list
      // once per project instead of once in total.
      analyzerReturns({
        ...EMPTY_ANALYSIS,
        atomizedRoots: ['apps/it', 'apps/e2e'],
      });

      await analyzeProjects(PROJECT_FILES);

      expect(hashedGlobs()[1]).toEqual(['apps/it/**/*.cs', 'apps/e2e/**/*.cs']);
    });

    it('does not glob a workspace-root project as "./**/*.cs"', async () => {
      // A workspace-root project's root is ".", so naively templating
      // "${root}/**/*.cs" produces "./**/*.cs" — a pattern the native glob
      // matcher treats as literally requiring a "./" path segment, which no
      // real file path has. That silently hashes zero files forever.
      analyzerReturns({ ...EMPTY_ANALYSIS, atomizedRoots: ['.'] });

      await analyzeProjects(PROJECT_FILES);

      expect(hashedGlobs()[1]).toEqual(['**/*.cs']);
    });

    it('also hashes sources that sit outside the project root', async () => {
      // Discovery reads MSBuild Compile items, which a <Compile Include="../..">
      // can point outside the project. The per-root glob cannot reach those, so
      // a linked test file would change the discovered units without changing
      // the hash.
      analyzerReturns({
        ...ATOMIZED_ANALYSIS,
        atomizedExternalSources: ['libs/shared-tests/Linked.cs'],
      });

      await analyzeProjects(PROJECT_FILES);

      expect(hashedGlobs()[1]).toEqual([
        'apps/it/**/*.cs',
        'libs/shared-tests/Linked.cs',
      ]);
    });

    it('re-runs when a linked source outside the project root changes', async () => {
      analyzerReturns({
        ...ATOMIZED_ANALYSIS,
        atomizedExternalSources: ['libs/shared-tests/Linked.cs'],
      });
      await analyzeProjects(PROJECT_FILES);
      expect(spawnCount()).toBe(1);

      clearCache();
      hashWithWorkspaceContext.mockImplementation(async (_root, globs) =>
        globs.some((g) => g.includes('shared-tests'))
          ? 'linked-source-changed'
          : globs.join('|')
      );

      await analyzeProjects(PROJECT_FILES);

      expect(spawnCount()).toBe(2);
    });

    it('reuses the cached result while sources are unchanged', async () => {
      analyzerReturns(ATOMIZED_ANALYSIS);
      await analyzeProjects(PROJECT_FILES);

      clearCache();
      await analyzeProjects(PROJECT_FILES);

      expect(spawnCount()).toBe(1);
    });

    it('re-runs when a source changes even though project files did not', async () => {
      // Adding a test class changes no .csproj, so the project-files hash is
      // identical.
      analyzerReturns(ATOMIZED_ANALYSIS);
      await analyzeProjects(PROJECT_FILES);
      expect(spawnCount()).toBe(1);

      clearCache();
      hashWithWorkspaceContext.mockImplementation(async (_root, globs) =>
        globs[0].endsWith('.cs') ? 'sources-changed' : globs.join('|')
      );

      await analyzeProjects(PROJECT_FILES);

      expect(spawnCount()).toBe(2);
    });

    it('does not re-run when an unrelated project’s sources change', async () => {
      analyzerReturns(ATOMIZED_ANALYSIS);
      await analyzeProjects(PROJECT_FILES);

      clearCache();
      // Hash of apps/it sources is unchanged; anything outside it is not part
      // of the glob group at all, so it cannot affect the result.
      await analyzeProjects(PROJECT_FILES);

      expect(spawnCount()).toBe(1);
    });
  });

  describe('options', () => {
    it('does not serve one registration’s analysis to another with different options', async () => {
      // Enabling test splitting for a subset of projects means registering
      // @nx/dotnet more than once, so analyzeProjects is called within one
      // process with the same files but different options. The on-disk cache is
      // per-options by filename; the in-memory one is a single shared slot.
      analyzerReturns(EMPTY_ANALYSIS);
      await analyzeProjects(PROJECT_FILES, { testTargetName: 'test' });

      await analyzeProjects(PROJECT_FILES, {
        testTargetName: 'test',
        testCiTargetName: 'test-ci',
      });

      expect(spawnCount()).toBe(2);
    });

    it('still serves the cached analysis for identical options', async () => {
      analyzerReturns(EMPTY_ANALYSIS);
      const options = { testTargetName: 'test' };

      await analyzeProjects(PROJECT_FILES, options);
      await analyzeProjects(PROJECT_FILES, { ...options });

      expect(spawnCount()).toBe(1);
    });
  });

  describe('cache entry compatibility', () => {
    it('ignores entries written in the pre-atomizer shape', async () => {
      // An old entry is the bare analysis, not { result, sourceHash }. Reading
      // `.result` off it yields undefined, which must be treated as a miss
      // rather than propagated as a broken analysis.
      seededEntries[PROJECT_FILES.join('|')] = EMPTY_ANALYSIS;
      analyzerReturns(EMPTY_ANALYSIS);

      const result = await analyzeProjects(PROJECT_FILES);

      expect(spawnCount()).toBe(1);
      expect(result).toEqual(EMPTY_ANALYSIS);
    });

    it('treats a result with no atomizedRoots field as non-atomizing', async () => {
      // Output from an analyzer that predates the field.
      analyzerReturns(EMPTY_ANALYSIS);

      await analyzeProjects(PROJECT_FILES);

      expect(hashedGlobs()).toEqual([PROJECT_FILES]);
    });
  });

  describe('errors', () => {
    it('does not write failures to the on-disk cache', async () => {
      analyzerFails('boom');

      const result = await analyzeProjects(PROJECT_FILES);

      expect('error' in result).toBe(true);
      expect(Object.values(pluginCacheStores).flatMap(Object.keys)).toEqual([]);
    });

    it('retries after a failure rather than serving the cached error', async () => {
      analyzerFails('boom');
      await analyzeProjects(PROJECT_FILES);

      analyzerReturns(EMPTY_ANALYSIS);
      const result = await analyzeProjects(PROJECT_FILES);

      expect('error' in result).toBe(false);
      expect(spawnCount()).toBe(2);
    });
  });
});
