/**
 * Side-effect module: registers a jest mock of `@nx/devkit`'s
 * `createProjectGraphAsync` for generator specs. It must remain a dedicated
 * subpath (not part of the internal-testing-utils barrel) because importing
 * it applies the mock — a barrel import would do so for every consumer.
 */
type MockFn = {
  (...args: unknown[]): unknown;
  mockImplementation(implementation: (...args: unknown[]) => unknown): MockFn;
};

declare const jest: {
  doMock(moduleName: '@nx/devkit', factory: () => unknown): void;
  fn(implementation?: (...args: unknown[]) => unknown): MockFn;
  requireActual<T extends Record<string, unknown> = Record<string, unknown>>(
    moduleName: string
  ): T;
};

jest.doMock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  createProjectGraphAsync: jest.fn().mockImplementation(async () => {
    return {
      nodes: {},
      dependencies: {},
    };
  }),
}));

export {};
