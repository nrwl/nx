// Shared by this package's vitest suite AND other packages' jest suites (via
// @nx/devkit's internal-testing-utils), so it registers the mock through
// whichever runner is active. Each runner's transform only hoists its own
// literal call, so the branch not taken stays inert.
declare const vi: any;

if (typeof vi !== 'undefined') {
  vi.mock('@nx/devkit', async () => ({
    ...(await vi.importActual<any>('@nx/devkit')),
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
