import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NormalizedAngularRspackPluginOptions } from '../models';
import { NG_RSPACK_SYMBOL_NAME, type NgRspackCompilation } from '../models';
import { AngularRspackPlugin } from './angular-rspack-plugin';

const {
  buildAndAnalyzeMock,
  setupCompilationMock,
  disposeComponentStylesheetBundlerMock,
  transformerCtorMock,
  transformerCloseMock,
  createJavascriptTransformerCacheMock,
  sourceFileCacheCtorMock,
  sourceFileCacheInstances,
} = vi.hoisted(() => ({
  buildAndAnalyzeMock: vi.fn(),
  setupCompilationMock: vi.fn(),
  disposeComponentStylesheetBundlerMock: vi.fn(),
  transformerCtorMock: vi.fn(),
  transformerCloseMock: vi.fn(),
  createJavascriptTransformerCacheMock: vi.fn(),
  sourceFileCacheCtorMock: vi.fn(),
  sourceFileCacheInstances: [] as Array<{
    invalidate: ReturnType<typeof vi.fn>;
    prune: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock('@nx/angular-rspack-compiler', () => ({
  buildAndAnalyze: buildAndAnalyzeMock,
  createJavascriptTransformerCache: createJavascriptTransformerCacheMock,
  DiagnosticModes: { All: 7, Semantic: 4 },
  disposeComponentStylesheetBundler: disposeComponentStylesheetBundlerMock,
  JavaScriptTransformer: class {
    close = transformerCloseMock;
    constructor(...args: unknown[]) {
      transformerCtorMock(...args);
    }
  },
  SourceFileCache: class {
    typeScriptFileCache = new Map<string, unknown>();
    babelFileCache = new Map<string, string>();
    referencedFiles: string[] = [];
    invalidate = vi.fn();
    prune = vi.fn();
    constructor(persistentCachePath?: string) {
      sourceFileCacheCtorMock(persistentCachePath);
      sourceFileCacheInstances.push(this);
    }
  },
  maxWorkers: () => 1,
  setupCompilationWithAngularCompilation: setupCompilationMock,
  AngularCompilation: class {},
}));

type Tap = { name: string; fn: (...args: unknown[]) => unknown };
function createHook() {
  const taps: Tap[] = [];
  return {
    taps,
    tap: (name: string, fn: Tap['fn']) => taps.push({ name, fn }),
    tapAsync: (name: string, fn: Tap['fn']) => taps.push({ name, fn }),
  };
}

class FakeWebpackError extends Error {}

function createFakeCompiler() {
  const compiler = {
    hooks: {
      beforeRun: createHook(),
      watchRun: createHook(),
      beforeCompile: createHook(),
      compilation: createHook(),
      thisCompilation: createHook(),
      emit: createHook(),
      afterEmit: createHook(),
      done: createHook(),
      afterDone: createHook(),
      shutdown: createHook(),
      normalModuleFactory: createHook(),
    },
    options: {
      resolve: { tsConfig: '/root/tsconfig.json' },
      stats: undefined,
      target: 'web',
    },
    rspack: {
      Compilation: { PROCESS_ASSETS_STAGE_ADDITIONS: 100 },
      WebpackError: FakeWebpackError,
      sources: {},
    },
    watching: undefined,
  };
  return compiler;
}

function createFakeCompilation(
  compiler: ReturnType<typeof createFakeCompiler>
) {
  return {
    errors: [] as Error[],
    warnings: [] as Error[],
    hooks: { afterSeal: createHook(), processAssets: createHook() },
    fileDependencies: { add: vi.fn() },
    compiler,
  };
}

async function fireAsyncTaps(
  hook: ReturnType<typeof createHook>,
  ...args: unknown[]
) {
  for (const tap of [...hook.taps]) {
    await new Promise<void>((resolve, reject) => {
      try {
        const result = tap.fn(...args, resolve);
        // rspack ignores promises returned from tapAsync functions, so a
        // rejection means the tap leaked an error instead of handling it -
        // fail the test in that case.
        if (result instanceof Promise) {
          result.catch(reject);
        }
      } catch (e) {
        reject(e);
      }
    });
  }
}

function fireSyncTaps(hook: ReturnType<typeof createHook>, ...args: unknown[]) {
  for (const tap of [...hook.taps]) {
    tap.fn(...args);
  }
}

describe('AngularRspackPlugin', () => {
  const options = {
    root: '/root',
    aot: true,
    tsConfig: '/root/tsconfig.json',
    inlineStyleLanguage: 'css',
    fileReplacements: [],
    hasServer: false,
    skipTypeChecking: false,
    sourceMap: { scripts: true, styles: true, hidden: false, vendor: false },
    advancedOptimizations: false,
    budgets: [],
    verbose: false,
    outputPath: { browser: '/root/dist/browser' },
  } as unknown as NormalizedAngularRspackPluginOptions;

  beforeEach(() => {
    vi.clearAllMocks();
    // The persistent cache is disabled when a CI environment is detected;
    // clear the variable so tests behave the same locally and in CI.
    vi.stubEnv('CI', '');
    transformerCloseMock.mockResolvedValue(undefined);
    disposeComponentStylesheetBundlerMock.mockResolvedValue(undefined);
    buildAndAnalyzeMock.mockResolvedValue(undefined);
    setupCompilationMock.mockResolvedValue({
      angularCompilation: { diagnoseFiles: vi.fn().mockResolvedValue({}) },
      collectedStylesheetAssets: [],
      collectedStylesheetMetafileInputs: [],
      useTypeScriptTranspilation: true,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function applyPlugin() {
    const compiler = createFakeCompiler();
    const plugin = new AngularRspackPlugin(options);
    plugin.apply(compiler as never);
    return compiler;
  }

  async function runBuildStart(
    compiler: ReturnType<typeof createFakeCompiler>
  ) {
    // beforeRun registers the beforeCompile tap that runs build and analyze
    await fireAsyncTaps(compiler.hooks.beforeRun, compiler);
    await fireAsyncTaps(compiler.hooks.beforeCompile, {});
  }

  it('should report an initialization failure as a compilation error and skip further compilation steps', async () => {
    setupCompilationMock.mockRejectedValue(new Error('NgtscProgram failed'));
    const compiler = applyPlugin();

    await runBuildStart(compiler);

    expect(buildAndAnalyzeMock).not.toHaveBeenCalled();

    const compilation = createFakeCompilation(compiler);
    fireSyncTaps(compiler.hooks.thisCompilation, compilation);
    expect(compilation.errors).toHaveLength(1);
    expect(compilation.errors[0].message).toContain(
      'Angular compilation initialization failed.'
    );
    expect(compilation.errors[0].message).toContain('NgtscProgram failed');

    // the loaders are signaled to short-circuit
    fireSyncTaps(compiler.hooks.compilation, compilation);
    const state = (compilation as unknown as NgRspackCompilation)[
      NG_RSPACK_SYMBOL_NAME
    ]();
    expect(state.angularCompilationFailed).toBe(true);

    // emit skips diagnostics (no angular compilation to diagnose) and does not throw
    await fireAsyncTaps(compiler.hooks.emit, compilation);
    expect(compilation.errors).toHaveLength(1);
  });

  it('should report an emit failure as a compilation error and still run diagnostics', async () => {
    const diagnoseFiles = vi.fn().mockResolvedValue({});
    setupCompilationMock.mockResolvedValue({
      angularCompilation: { diagnoseFiles },
      collectedStylesheetAssets: [],
    });
    buildAndAnalyzeMock.mockRejectedValue(new Error('worker crashed'));
    const compiler = applyPlugin();

    await runBuildStart(compiler);

    const compilation = createFakeCompilation(compiler);
    fireSyncTaps(compiler.hooks.thisCompilation, compilation);
    expect(compilation.errors).toHaveLength(1);
    expect(compilation.errors[0].message).toContain(
      'Angular compilation emit failed.'
    );
    expect(compilation.errors[0].message).toContain('worker crashed');

    // the loaders are signaled to short-circuit
    fireSyncTaps(compiler.hooks.compilation, compilation);
    const state = (compilation as unknown as NgRspackCompilation)[
      NG_RSPACK_SYMBOL_NAME
    ]();
    expect(state.angularCompilationFailed).toBe(true);

    // unlike an initialization failure, diagnostics still run - they
    // usually carry the root cause of the emit failure
    await fireAsyncTaps(compiler.hooks.emit, compilation);
    expect(diagnoseFiles).toHaveBeenCalled();
  });

  it('should surface a diagnostics failure as a build error instead of hanging the build', async () => {
    const diagnoseFiles = vi
      .fn()
      .mockRejectedValue(new Error('diagnostics crashed'));
    setupCompilationMock.mockResolvedValue({
      angularCompilation: { diagnoseFiles },
      collectedStylesheetAssets: [],
    });
    const compiler = applyPlugin();

    await runBuildStart(compiler);

    const compilation = createFakeCompilation(compiler);
    // emit must resolve (the callback fires) rather than leak the rejection
    await fireAsyncTaps(compiler.hooks.emit, compilation);

    expect(
      compilation.errors.some((error) =>
        error.message.includes('Angular diagnostics failed.')
      )
    ).toBe(true);
  });

  it('should not close the JS transformer worker pool on emit', async () => {
    const compiler = applyPlugin();

    await runBuildStart(compiler);

    const compilation = createFakeCompilation(compiler);
    await fireAsyncTaps(compiler.hooks.emit, compilation);

    expect(transformerCloseMock).not.toHaveBeenCalled();
  });

  it('should clear the error and recover on a rebuild that initializes successfully', async () => {
    setupCompilationMock.mockRejectedValueOnce(new Error('transient failure'));
    const compiler = applyPlugin();

    // first watch build fails to initialize
    await fireAsyncTaps(compiler.hooks.watchRun, compiler);
    await fireAsyncTaps(compiler.hooks.beforeCompile, {});
    const failedCompilation = createFakeCompilation(compiler);
    fireSyncTaps(compiler.hooks.thisCompilation, failedCompilation);
    expect(failedCompilation.errors).toHaveLength(1);
    expect(buildAndAnalyzeMock).not.toHaveBeenCalled();

    // next rebuild initializes successfully and recovers
    await fireAsyncTaps(compiler.hooks.watchRun, compiler);
    await fireAsyncTaps(compiler.hooks.beforeCompile, {});
    const compilation = createFakeCompilation(compiler);
    fireSyncTaps(compiler.hooks.thisCompilation, compilation);
    expect(compilation.errors).toHaveLength(0);
    expect(buildAndAnalyzeMock).toHaveBeenCalledTimes(1);

    fireSyncTaps(compiler.hooks.compilation, compilation);
    const state = (compilation as unknown as NgRspackCompilation)[
      NG_RSPACK_SYMBOL_NAME
    ]();
    expect(state.angularCompilationFailed).toBe(false);
  });

  it('should keep reporting setup warnings while initialization fails and clear them after success', async () => {
    const setupError = Object.assign(new Error('transient failure'), {
      setupWarnings: ['target raised'],
    });
    setupCompilationMock.mockResolvedValue({
      angularCompilation: { diagnoseFiles: vi.fn().mockResolvedValue({}) },
      collectedStylesheetAssets: [],
      collectedStylesheetMetafileInputs: [],
      useTypeScriptTranspilation: true,
      setupWarnings: ['target raised'],
    });
    setupCompilationMock.mockRejectedValueOnce(setupError);
    const compiler = applyPlugin();

    // initial build fails to initialize; the setup warnings ride along on
    // the failure and land on this build alongside the error
    await runBuildStart(compiler);
    const failedCompilation = createFakeCompilation(compiler);
    fireSyncTaps(compiler.hooks.thisCompilation, failedCompilation);
    expect(failedCompilation.warnings).toHaveLength(1);
    expect(failedCompilation.warnings[0].message).toContain('target raised');

    // the successful rebuild reports the warnings again (isInitialSetup is
    // still true since no compilation was ever assigned)
    await fireAsyncTaps(compiler.hooks.watchRun, compiler);
    await fireAsyncTaps(compiler.hooks.beforeCompile, {});
    const recoveredCompilation = createFakeCompilation(compiler);
    fireSyncTaps(compiler.hooks.thisCompilation, recoveredCompilation);
    expect(recoveredCompilation.warnings).toHaveLength(1);
    expect(recoveredCompilation.warnings[0].message).toContain('target raised');

    // and clears them so later rebuilds stay quiet
    const laterCompilation = createFakeCompilation(compiler);
    fireSyncTaps(compiler.hooks.thisCompilation, laterCompilation);
    expect(laterCompilation.warnings).toHaveLength(0);
  });

  it('should run only option and syntactic diagnostics when type checking is skipped', async () => {
    const diagnoseFiles = vi.fn().mockResolvedValue({});
    setupCompilationMock.mockResolvedValue({
      angularCompilation: { diagnoseFiles },
      collectedStylesheetAssets: [],
    });
    const compiler = createFakeCompiler();
    const plugin = new AngularRspackPlugin({
      ...options,
      skipTypeChecking: true,
    } as never);
    plugin.apply(compiler as never);

    await runBuildStart(compiler);

    // DiagnosticModes.All & ~DiagnosticModes.Semantic === 7 & ~4 === 3
    expect(diagnoseFiles).toHaveBeenCalledWith(3);

    // the diagnostics result is still consumed on emit without erroring
    const compilation = createFakeCompilation(compiler);
    await fireAsyncTaps(compiler.hooks.emit, compilation);
    expect(compilation.errors).toHaveLength(0);
  });

  it('should not throw from afterDone when the run failed before producing stats', async () => {
    const compiler = applyPlugin();

    expect(() =>
      fireSyncTaps(compiler.hooks.afterDone, undefined)
    ).not.toThrow();
  });

  it('should release the worker pool and the stylesheet bundler on shutdown', async () => {
    const compiler = applyPlugin();

    await fireAsyncTaps(compiler.hooks.shutdown);

    expect(transformerCloseMock).toHaveBeenCalled();
    expect(disposeComponentStylesheetBundlerMock).toHaveBeenCalled();
  });

  it('should close the Angular compilation on shutdown', async () => {
    const close = vi.fn();
    setupCompilationMock.mockResolvedValue({
      angularCompilation: {
        diagnoseFiles: vi.fn().mockResolvedValue({}),
        close,
      },
      collectedStylesheetAssets: [],
    });
    const compiler = applyPlugin();
    await runBuildStart(compiler);

    await fireAsyncTaps(compiler.hooks.shutdown);

    expect(close).toHaveBeenCalled();
  });

  it('should start diagnostics with the build and reuse the result on emit', async () => {
    const diagnoseFiles = vi
      .fn()
      .mockResolvedValue({ errors: [{ text: 'type error' }] });
    setupCompilationMock.mockResolvedValue({
      angularCompilation: { diagnoseFiles },
      collectedStylesheetAssets: [],
    });
    const compiler = applyPlugin();

    await runBuildStart(compiler);
    expect(diagnoseFiles).toHaveBeenCalledTimes(1);

    const compilation = createFakeCompilation(compiler);
    await fireAsyncTaps(compiler.hooks.emit, compilation);

    expect(diagnoseFiles).toHaveBeenCalledTimes(1);
    expect(
      compilation.errors.some((error) => error.message.includes('type error'))
    ).toBe(true);
  });

  it('should use a persistent cache path scoped to the project', () => {
    new AngularRspackPlugin({ ...options, projectName: 'app' });

    expect(sourceFileCacheCtorMock).toHaveBeenCalledWith(
      expect.stringContaining(join('.angular', 'cache'))
    );
    expect(sourceFileCacheCtorMock).toHaveBeenCalledWith(
      expect.stringContaining(join('app', 'angular-rspack'))
    );
  });

  it('should scope the persistent cache path by the project root without a project name', () => {
    new AngularRspackPlugin(options);

    expect(sourceFileCacheCtorMock).toHaveBeenCalledWith(
      expect.stringContaining(join('.angular', 'cache'))
    );
    expect(sourceFileCacheCtorMock).toHaveBeenCalledWith(
      expect.stringContaining(join('root', 'angular-rspack'))
    );
  });

  it('should give the transformer a persistent cache when a cache path is available', async () => {
    const cache = { get: vi.fn(), put: vi.fn() };
    const close = vi.fn();
    createJavascriptTransformerCacheMock.mockReturnValueOnce({ cache, close });

    const plugin = new AngularRspackPlugin({ ...options, projectName: 'app' });

    expect(createJavascriptTransformerCacheMock).toHaveBeenCalledWith(
      expect.stringContaining(join('app', 'angular-rspack'))
    );
    expect(transformerCtorMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      cache
    );

    const compiler = createFakeCompiler();
    plugin.apply(compiler as never);
    await fireAsyncTaps(compiler.hooks.shutdown);
    expect(close).toHaveBeenCalled();
  });

  it('should not create a transformer cache when the persistent cache is disabled', () => {
    vi.stubEnv('CI', '1');

    new AngularRspackPlugin(options);

    expect(createJavascriptTransformerCacheMock).not.toHaveBeenCalled();
    expect(transformerCtorMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      undefined
    );
  });

  it.each(['1', 'true', 'TRUE'])(
    'should not use a persistent cache path when CI is "%s"',
    (ci) => {
      vi.stubEnv('CI', ci);

      new AngularRspackPlugin({ ...options, projectName: 'app' });

      expect(sourceFileCacheCtorMock).toHaveBeenCalledWith(undefined);
    }
  );

  it.each(['0', 'false'])(
    'should keep the persistent cache path when CI is "%s"',
    (ci) => {
      vi.stubEnv('CI', ci);

      new AngularRspackPlugin({ ...options, projectName: 'app' });

      expect(sourceFileCacheCtorMock).toHaveBeenCalledWith(
        expect.stringContaining(join('.angular', 'cache'))
      );
    }
  );

  it('should not use a persistent cache path in a web container', () => {
    const versions = process.versions as { webcontainer?: string };
    versions.webcontainer = '1.0.0';
    try {
      new AngularRspackPlugin({ ...options, projectName: 'app' });

      expect(sourceFileCacheCtorMock).toHaveBeenCalledWith(undefined);
    } finally {
      delete versions.webcontainer;
    }
  });

  it('should invalidate modified and removed files and prune removed files on rebuilds', async () => {
    const angularCompilation = {
      diagnoseFiles: vi.fn().mockResolvedValue({}),
      update: vi.fn(),
    };
    setupCompilationMock.mockResolvedValue({
      angularCompilation,
      collectedStylesheetAssets: [],
      collectedStylesheetMetafileInputs: [],
    });
    const compiler = createFakeCompiler();
    const plugin = new AngularRspackPlugin(options);
    plugin.apply(compiler as never);

    // first watch build initializes the compilation
    await fireAsyncTaps(compiler.hooks.watchRun, compiler);
    await fireAsyncTaps(compiler.hooks.beforeCompile, {});

    (compiler as { watching?: unknown }).watching = {
      compiler: {
        modifiedFiles: new Set(['/root/src/modified.ts']),
        removedFiles: new Set(['/root/src/removed.ts']),
      },
    };
    await fireAsyncTaps(compiler.hooks.beforeCompile, {});

    // A worker-based compilation tracks modified files itself.
    expect(angularCompilation.update).toHaveBeenCalledWith(
      new Set(['/root/src/modified.ts', '/root/src/removed.ts'])
    );
    const sourceFileCache = sourceFileCacheInstances.at(-1)!;
    expect(sourceFileCache.invalidate).toHaveBeenCalledWith(
      new Set(['/root/src/modified.ts', '/root/src/removed.ts'])
    );
    expect(sourceFileCache.prune).toHaveBeenCalledWith(
      new Set(['/root/src/removed.ts'])
    );
    expect(setupCompilationMock).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      new Set(['/root/src/modified.ts', '/root/src/removed.ts'])
    );
  });

  it('should expose the TypeScript transpilation mode and stylesheet metafile inputs to the loaders', async () => {
    const resourceDependencies = new Map([
      ['/root/src/app/app.component.ts', ['/root/src/app/app.component.html']],
    ]);
    setupCompilationMock.mockResolvedValue({
      angularCompilation: { diagnoseFiles: vi.fn().mockResolvedValue({}) },
      collectedStylesheetAssets: [],
      collectedStylesheetMetafileInputs: [
        {
          source: '/root/src/app/app.component.scss',
          inputs: { 'node_modules/css-pkg/styles.css': { bytesInOutput: 5 } },
        },
      ],
      useTypeScriptTranspilation: false,
      resourceDependencies,
    });
    const compiler = applyPlugin();

    await runBuildStart(compiler);

    const compilation = createFakeCompilation(compiler);
    fireSyncTaps(compiler.hooks.compilation, compilation);
    const state = (compilation as unknown as NgRspackCompilation)[
      NG_RSPACK_SYMBOL_NAME
    ]();
    expect(state.useTypeScriptTranspilation).toBe(false);
    expect(state.stylesheetMetafileInputs).toEqual({
      'node_modules/css-pkg/styles.css': { bytesInOutput: 5 },
    });
    expect(state.resourceDependencies).toBe(resourceDependencies);
  });

  it('should drop stylesheet metafile inputs for modified files, including inline-style entries', async () => {
    setupCompilationMock.mockResolvedValueOnce({
      angularCompilation: { diagnoseFiles: vi.fn().mockResolvedValue({}) },
      collectedStylesheetAssets: [],
      collectedStylesheetMetafileInputs: [
        {
          source: '/root/src/app/app.component.ts?class=AppComponent&order=0',
          inputs: { 'node_modules/css-pkg/styles.css': { bytesInOutput: 5 } },
        },
        {
          source: '/root/src/app/other.component.scss',
          inputs: { 'node_modules/other-pkg/styles.css': { bytesInOutput: 5 } },
        },
      ],
      useTypeScriptTranspilation: true,
    });
    const compiler = createFakeCompiler();
    const plugin = new AngularRspackPlugin(options);
    plugin.apply(compiler as never);

    // first watch build collects the stylesheet inputs
    await fireAsyncTaps(compiler.hooks.watchRun, compiler);
    await fireAsyncTaps(compiler.hooks.beforeCompile, {});

    // rebuild with the inline-styled component modified
    (compiler as { watching?: unknown }).watching = {
      compiler: {
        modifiedFiles: new Set(['/root/src/app/app.component.ts']),
        removedFiles: new Set<string>(),
      },
    };
    await fireAsyncTaps(compiler.hooks.beforeCompile, {});

    const compilation = createFakeCompilation(compiler);
    fireSyncTaps(compiler.hooks.compilation, compilation);
    const state = (compilation as unknown as NgRspackCompilation)[
      NG_RSPACK_SYMBOL_NAME
    ]();
    expect(state.stylesheetMetafileInputs).toEqual({
      'node_modules/other-pkg/styles.css': { bytesInOutput: 5 },
    });
  });
});
