import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CompilerOptions } from 'typescript';
import { setupCompilation } from './setup-compilation';

const readConfiguration = vi.fn();

vi.mock('../utils', () => ({
  loadCompilerCli: vi.fn(async () => ({ readConfiguration })),
}));

vi.mock('../utils/assert-supported-versions', () => ({
  assertSupportedAngularRspackCompilerVersions: vi.fn(),
}));

vi.mock('../utils/targets-from-browsers', () => ({
  transformSupportedBrowsersToTargets: vi.fn(() => []),
}));

vi.mock('@angular/build/private', () => ({
  ComponentStylesheetBundler: class {
    dispose = vi.fn();
  },
  findTailwindConfiguration: vi.fn(() => undefined),
  generateSearchDirectories: vi.fn(async () => []),
  loadPostcssConfiguration: vi.fn(async () => undefined),
  getSupportedBrowsers: vi.fn(() => []),
}));

describe('setupCompilation sourcemap options', () => {
  const baseOptions = {
    root: '/root',
    tsConfig: '/root/tsconfig.json',
    aot: true,
    inlineStyleLanguage: 'css' as const,
    fileReplacements: [],
  };

  // Capture the compiler options that `setupCompilation` merges and passes to
  // the Angular compiler-cli's `readConfiguration`.
  const getMergedOptions = (): CompilerOptions =>
    readConfiguration.mock.calls.at(-1)?.[1];

  beforeEach(() => {
    vi.clearAllMocks();
    readConfiguration.mockReturnValue({ options: {}, rootNames: [] });
  });

  it('emits an inline sourcemap with sources when sourcemaps are enabled', async () => {
    await setupCompilation({ mode: 'development' }, { ...baseOptions });

    const merged = getMergedOptions();
    // An external `.js.map` is not readable by the downstream
    // JavaScriptTransformer/linker, so the intermediate map must be inline.
    expect(merged.sourceMap).toBe(false);
    expect(merged.inlineSourceMap).toBe(true);
    expect(merged.inlineSources).toBe(true);
  });

  it('respects an explicit sourceMap: false', async () => {
    await setupCompilation(
      { mode: 'development' },
      { ...baseOptions, sourceMap: false }
    );

    const merged = getMergedOptions();
    expect(merged.inlineSourceMap).toBe(false);
    expect(merged.inlineSources).toBe(false);
  });

  it('disables sourcemaps entirely for the project-references path', async () => {
    await setupCompilation(
      { mode: 'development' },
      { ...baseOptions, useTsProjectReferences: true }
    );

    const merged = getMergedOptions();
    expect(merged.sourceMap).toBe(false);
    expect(merged.inlineSourceMap).toBe(false);
    expect(merged.inlineSources).toBe(false);
    expect(merged.isolatedModules).toBe(true);
  });
});
