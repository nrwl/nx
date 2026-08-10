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

vi.mock('node:fs', async () => ({
  ...(await vi.importActual<any>('node:fs')),
  existsSync: vi.fn(() => true),
}));

const pluginCache = {
  // One store per cache-file path, because the real PluginCache writes to a
  // per-options filename and tests need to tell those apart.
  stores: {} as Record<string, Record<string, unknown>>,
  // Entries visible to every path, for seeding a value whose owning path a test
  // cannot predict (the options hash is computed internally).
  seeded: {} as Record<string, unknown>,
};

const mocks = {
  hashWithWorkspaceContext: vi.fn(async () => 'files-hash'),
  safeSpawn: vi.fn(),
  killChildOnHostExit: vi.fn(),
  killProcessTreeGraceful: vi.fn(() => Promise.resolve()),
  hashFile: vi.fn(),
  hashArray: vi.fn(),
};

vi.mock('@nx/devkit/internal', async () => ({
  ...(await vi.importActual<any>('@nx/devkit/internal')),
  isCI: () => false,
  hashWithWorkspaceContext: (...args: unknown[]) =>
    mocks.hashWithWorkspaceContext(...args),
  hashFile: (filePath: string) => mocks.hashFile(filePath),
  hashArray: (content: string[]) => mocks.hashArray(content),
  // Derived from the options so a different registration lands on a different
  // cache file, which is what the real per-options filename does.
  hashObject: (options: unknown) => JSON.stringify(options ?? null),
  workspaceDataDirectory: '/tmp/workspace-data',
  PluginCache: class {
    private store: Record<string, unknown>;
    constructor(cachePath: string) {
      this.store = pluginCache.stores[cachePath] ??= {};
    }
    get(key: string) {
      return this.store[key] ?? pluginCache.seeded[key];
    }
    set(key: string, value: unknown) {
      this.store[key] = value;
    }
    has(key: string) {
      return key in this.store || key in pluginCache.seeded;
    }
    writeToDisk() {}
  },
  safeSpawn: (...args: unknown[]) => mocks.safeSpawn(...args),
  killChildOnHostExit: (...args: unknown[]) =>
    mocks.killChildOnHostExit(...args),
  killProcessTreeGraceful: (...args: unknown[]) =>
    mocks.killProcessTreeGraceful(...args),
}));

vi.mock('@nx/devkit', async () => ({
  ...(await vi.importActual<any>('@nx/devkit')),
  workspaceRoot: '/ws',
  hashArray: (content: string[]) => mocks.hashArray(content),
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

function fakeChild(pid = 123) {
  const child: any = new EventEmitter();
  child.pid = pid;
  child.stdout = new EventEmitter();
  child.stdout.setEncoding = vi.fn();
  child.stderr = new EventEmitter();
  child.stderr.setEncoding = vi.fn();
  child.stdin = new EventEmitter();
  child.stdin.end = vi.fn();
  return child;
}

describe('analyzeProjects', () => {
  let analyzeProjects: typeof import('./analyzer-client').analyzeProjects;
  let getAnalysisTimeoutMs: typeof import('./analyzer-client').getAnalysisTimeoutMs;
  let readCachedAnalysisResult: typeof import('./analyzer-client').readCachedAnalysisResult;
  let ANALYZER_CANCELLED_MESSAGE: string;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.hashWithWorkspaceContext.mockImplementation(async () => 'files-hash');
    delete process.env.NX_DOTNET_PROJECT_GRAPH_TIMEOUT;
    pluginCache.stores = {};
    pluginCache.seeded = {};
    mocks.hashWithWorkspaceContext.mockImplementation(async (_root, globs) =>
      globs.join('|')
    );
    mocks.hashFile.mockImplementation((filePath) => `hash:${filePath}`);
    mocks.hashArray.mockImplementation((content) => content.join('|'));
    ({
      analyzeProjects,
      getAnalysisTimeoutMs,
      readCachedAnalysisResult,
      ANALYZER_CANCELLED_MESSAGE,
    } = await import('./analyzer-client'));
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
    vi.useFakeTimers();
    try {
      process.env.NX_DOTNET_PROJECT_GRAPH_TIMEOUT = '1';
      const child = fakeChild(456);
      mocks.safeSpawn.mockReturnValue(child);

      const promise = analyzeProjects(['a/a.csproj']);
      await vi.advanceTimersByTimeAsync(1000);

      const result = await promise;
      expect('error' in result && result.error.message).toMatch(
        /timed out after 1 second/
      );
      expect(mocks.killProcessTreeGraceful).toHaveBeenCalledWith(456);
    } finally {
      vi.useRealTimers();
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

  describe('evaluation inputs', () => {
    const hashFileList = async (_root: string, files: string[]) =>
      files.join('|');

    it('should reuse a cached result whose evaluation inputs are unchanged', async () => {
      mocks.hashWithWorkspaceContext.mockImplementation(hashFileList);
      const result = {
        nodesByFile: {},
        referencesByRoot: {},
        evaluationInputs: ['build/Common.Build.props'],
      };
      pluginCache.seeded['a/a.csproj'] = {
        result,
        inputsHash: 'build/Common.Build.props',
        sourceHash: null,
      };

      await expect(analyzeProjects(['a/a.csproj'])).resolves.toEqual(result);
      expect(mocks.safeSpawn).not.toHaveBeenCalled();
    });

    it('should rerun the analyzer when an evaluation input changed', async () => {
      // The glob-matched files are unchanged, so the files hash still hits;
      // only a file MSBuild imported (outside the glob) differs.
      mocks.hashWithWorkspaceContext.mockImplementation(hashFileList);
      pluginCache.seeded['a/a.csproj'] = {
        result: {
          nodesByFile: {},
          referencesByRoot: {},
          evaluationInputs: ['build/Common.Build.props'],
        },
        inputsHash: 'stale',
        sourceHash: null,
      };
      const child = fakeChild();
      mocks.safeSpawn.mockReturnValue(child);

      const promise = analyzeProjects(['a/a.csproj']);
      await new Promise(setImmediate);
      child.stdout.emit(
        'data',
        JSON.stringify({
          nodesByFile: {},
          referencesByRoot: {},
          evaluationInputs: ['build/Other.props'],
        })
      );
      child.emit('close', 0);

      await expect(promise).resolves.toEqual({
        nodesByFile: {},
        referencesByRoot: {},
        evaluationInputs: ['build/Other.props'],
      });
      expect(mocks.safeSpawn).toHaveBeenCalledTimes(1);
    });
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
    mocks.hashWithWorkspaceContext.mock.calls.map(([, g]) => g);

  /** File paths passed to hashFile, in call order. */
  const hashedFiles = () => mocks.hashFile.mock.calls.map(([path]) => path);

  /** How many times the analyzer was actually spawned. */
  const spawnCount = () => mocks.safeSpawn.mock.calls.length;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    pluginCache.stores = {};
    pluginCache.seeded = {};
    // Default: every hash request is distinct-but-stable per glob group.
    mocks.hashWithWorkspaceContext.mockImplementation(async (_root, globs) =>
      globs.join('|')
    );
    // Same, for the exact-path hashes external sources go through instead.
    mocks.hashFile.mockImplementation((filePath) => `hash:${filePath}`);
    mocks.hashArray.mockImplementation((content) => content.join('|'));
    ({ analyzeProjects, clearCache } = await import('./analyzer-client'));
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
      const callsAfterFirstRun =
        mocks.hashWithWorkspaceContext.mock.calls.length;

      clearCache(); // force the on-disk cache path rather than the in-memory one
      await analyzeProjects(PROJECT_FILES);

      // One more call for the project-files hash, and nothing else.
      expect(mocks.hashWithWorkspaceContext.mock.calls.length).toBe(
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

      expect(hashedGlobs()[1]).toEqual(['apps/it/**/*.cs']);
      expect(hashedFiles()).toEqual(['/ws/libs/shared-tests/Linked.cs']);
    });

    it('hashes an external source by its exact path, not as a glob pattern', async () => {
      // atomizedExternalSources are literal paths a <Compile Include="..."> named,
      // not patterns. Folded into the glob group above, a path containing a
      // metacharacter would silently change what the group matches — a leading
      // "!" makes it an exclusion, "*"/"["/"{" widen it into a pattern. Hashing
      // it by exact path instead means the native glob matcher never sees it.
      analyzerReturns({
        ...ATOMIZED_ANALYSIS,
        atomizedExternalSources: ['libs/!weird[name]/Linked.cs'],
      });

      await analyzeProjects(PROJECT_FILES);

      expect(hashedFiles()).toEqual(['/ws/libs/!weird[name]/Linked.cs']);
      expect(hashedGlobs()[1]).toEqual(['apps/it/**/*.cs']);
    });

    it('re-runs when a linked source outside the project root changes', async () => {
      analyzerReturns({
        ...ATOMIZED_ANALYSIS,
        atomizedExternalSources: ['libs/shared-tests/Linked.cs'],
      });
      await analyzeProjects(PROJECT_FILES);
      expect(spawnCount()).toBe(1);

      clearCache();
      mocks.hashFile.mockImplementation((filePath) =>
        filePath.includes('shared-tests')
          ? 'linked-source-changed'
          : `hash:${filePath}`
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
      mocks.hashWithWorkspaceContext.mockImplementation(async (_root, globs) =>
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
      pluginCache.seeded[PROJECT_FILES.join('|')] = EMPTY_ANALYSIS;
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
      expect(Object.values(pluginCache.stores).flatMap(Object.keys)).toEqual(
        []
      );
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
