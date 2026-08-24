import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import type { Tree } from '@nx/devkit';
import { NoTargetsToMigrateError } from '@nx/devkit/internal';
import { convertToInferredGenerator } from './infer-targets';

// Tracks the wrapper the generator uses for non-final conversions. The real
// suppression semantics (Tree-scoped depth counter, effect on hoisting) are
// covered by the devkit engine specs; here only the wiring is pinned: which
// conversions run inside the wrapper.
const mockSuppression = { depth: 0 };
const mockGeneratorImpls: Record<
  string,
  (tree: Tree, options: unknown) => Promise<unknown>
> = {};

jest.mock('@nx/devkit/internal', () => ({
  ...jest.requireActual('@nx/devkit/internal'),
  findInstalledPlugins: () => [
    { name: '@nx/a' },
    { name: '@nx/b' },
    { name: '@nx/c' },
  ],
  getGeneratorInformation: (collectionName: string) => ({
    resolvedCollectionName: collectionName,
    generatorConfiguration: { hidden: false },
    implementationFactory: () => mockGeneratorImpls[collectionName],
  }),
  withCentralizationSuppressed: async (_tree: Tree, fn: () => unknown) => {
    mockSuppression.depth++;
    try {
      return await fn();
    } finally {
      mockSuppression.depth--;
    }
  },
}));

jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  createProjectGraphAsync: async () => ({ nodes: {}, dependencies: {} }),
}));

describe('convertToInferredGenerator', () => {
  let tree: Tree;
  let runs: { collection: string; suppressed: boolean }[];

  const registerConversion = (
    collection: string,
    impl?: (tree: Tree, options: unknown) => Promise<unknown>
  ) => {
    mockGeneratorImpls[collection] = jest.fn(async (t, options) => {
      runs.push({ collection, suppressed: mockSuppression.depth > 0 });
      return impl?.(t, options);
    });
  };

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    runs = [];
    for (const collection of ['@nx/a', '@nx/b', '@nx/c']) {
      registerConversion(collection);
    }
  });

  it('suppresses centralization for every conversion except the final one', async () => {
    await convertToInferredGenerator(tree, {
      plugins: ['@nx/a', '@nx/b', '@nx/c'],
      skipFormat: true,
    });

    expect(runs).toEqual([
      { collection: '@nx/a', suppressed: true },
      { collection: '@nx/b', suppressed: true },
      { collection: '@nx/c', suppressed: false },
    ]);
  });

  it('runs a single conversion unsuppressed', async () => {
    await convertToInferredGenerator(tree, {
      plugins: ['@nx/b'],
      skipFormat: true,
    });

    expect(runs).toEqual([{ collection: '@nx/b', suppressed: false }]);
  });

  it('continues the batch when a conversion has no targets to migrate', async () => {
    registerConversion('@nx/b', async () => {
      throw new NoTargetsToMigrateError();
    });

    await convertToInferredGenerator(tree, {
      plugins: ['@nx/a', '@nx/b', '@nx/c'],
      skipFormat: true,
    });

    // the final conversion still runs unsuppressed after the skipped one
    expect(runs).toEqual([
      { collection: '@nx/a', suppressed: true },
      { collection: '@nx/b', suppressed: true },
      { collection: '@nx/c', suppressed: false },
    ]);
  });

  it('keeps earlier conversions suppressed when the final conversion has no targets to migrate', async () => {
    // The final conversion is only ELIGIBLE to centralize; when it has nothing
    // to migrate, the earlier conversions have already run suppressed and
    // nothing centralizes in this run (lossless: full per-project
    // configuration was written).
    registerConversion('@nx/c', async () => {
      throw new NoTargetsToMigrateError();
    });

    await convertToInferredGenerator(tree, {
      plugins: ['@nx/a', '@nx/b', '@nx/c'],
      skipFormat: true,
    });

    expect(runs).toEqual([
      { collection: '@nx/a', suppressed: true },
      { collection: '@nx/b', suppressed: true },
      { collection: '@nx/c', suppressed: false },
    ]);
  });

  it('rethrows a fatal conversion error without running later conversions', async () => {
    registerConversion('@nx/b', async () => {
      throw new Error('boom');
    });

    await expect(
      convertToInferredGenerator(tree, {
        plugins: ['@nx/a', '@nx/b', '@nx/c'],
        skipFormat: true,
      })
    ).rejects.toThrow('boom');

    expect(runs.map((r) => r.collection)).toEqual(['@nx/a', '@nx/b']);
  });
});
