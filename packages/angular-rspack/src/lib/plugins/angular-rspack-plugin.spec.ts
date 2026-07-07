import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NormalizedAngularRspackPluginOptions } from '../models';
import { NG_RSPACK_SYMBOL_NAME, type NgRspackCompilation } from '../models';
import { AngularRspackPlugin } from './angular-rspack-plugin';

const {
  buildAndAnalyzeMock,
  setupCompilationMock,
  disposeComponentStylesheetBundlerMock,
  transformerCloseMock,
} = vi.hoisted(() => ({
  buildAndAnalyzeMock: vi.fn(),
  setupCompilationMock: vi.fn(),
  disposeComponentStylesheetBundlerMock: vi.fn(),
  transformerCloseMock: vi.fn(),
}));

vi.mock('@nx/angular-rspack-compiler', () => ({
  buildAndAnalyze: buildAndAnalyzeMock,
  DiagnosticModes: { All: 7 },
  disposeComponentStylesheetBundler: disposeComponentStylesheetBundlerMock,
  JavaScriptTransformer: class {
    close = transformerCloseMock;
  },
  SourceFileCache: class {
    typeScriptFileCache = new Map<string, string | Uint8Array>();
    referencedFiles: string[] = [];
    invalidate = vi.fn();
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
    transformerCloseMock.mockResolvedValue(undefined);
    disposeComponentStylesheetBundlerMock.mockResolvedValue(undefined);
    buildAndAnalyzeMock.mockResolvedValue(undefined);
    setupCompilationMock.mockResolvedValue({
      angularCompilation: { diagnoseFiles: vi.fn().mockResolvedValue({}) },
      collectedStylesheetAssets: [],
      collectedStylesheetMetafileInputs: [],
    });
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

    expect(transformerCloseMock).toHaveBeenCalled();
    expect(
      compilation.errors.some((error) =>
        error.message.includes('Angular diagnostics failed.')
      )
    ).toBe(true);
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

  it('should expose the stylesheet metafile inputs to other plugins', async () => {
    setupCompilationMock.mockResolvedValue({
      angularCompilation: { diagnoseFiles: vi.fn().mockResolvedValue({}) },
      collectedStylesheetAssets: [],
      collectedStylesheetMetafileInputs: [
        {
          source: '/root/src/app/app.component.scss',
          inputs: { 'node_modules/css-pkg/styles.css': { bytesInOutput: 5 } },
        },
      ],
    });
    const compiler = applyPlugin();

    await runBuildStart(compiler);

    const compilation = createFakeCompilation(compiler);
    fireSyncTaps(compiler.hooks.compilation, compilation);
    const state = (compilation as unknown as NgRspackCompilation)[
      NG_RSPACK_SYMBOL_NAME
    ]();
    expect(state.stylesheetMetafileInputs).toEqual({
      'node_modules/css-pkg/styles.css': { bytesInOutput: 5 },
    });
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
