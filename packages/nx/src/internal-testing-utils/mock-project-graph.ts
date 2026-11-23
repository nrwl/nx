// Shared by this package's vitest suite AND other packages' jest suites (via
// @nx/devkit's internal-testing-utils), so it registers the mock through
// whichever runner is active. Each runner's transform only hoists its own
// literal call, so the branch not taken stays inert.

type ModuleExports = Record<string, unknown>;

interface MockFn {
  mockImplementation(impl: () => Promise<unknown>): unknown;
}

// Module-scoped so they type both runners' globals under either runner's types.
declare const vi:
  | {
      mock(path: string, factory: () => Promise<ModuleExports>): void;
      fn(): MockFn;
      importActual(path: string): Promise<ModuleExports>;
    }
  | undefined;
declare const jest: {
  mock(path: string, factory: () => ModuleExports): void;
  fn(): MockFn;
  requireActual(path: string): ModuleExports;
};

if (typeof vi !== 'undefined') {
  vi.mock('@nx/devkit', async () => ({
    ...(await vi.importActual('@nx/devkit')),
    createProjectGraphAsync: vi.fn().mockImplementation(async () => {
      return {
        nodes: {},
        dependencies: {},
      };
    }),
  }));
} else {
  jest.mock('@nx/devkit', () => ({
    ...jest.requireActual('@nx/devkit'),
    createProjectGraphAsync: jest.fn().mockImplementation(async () => {
      return {
        nodes: {},
        dependencies: {},
      };
    }),
  }));
}

export {};
