// Setup file to handle spy redefinition issues
// Reset all module spies after each test file

// If a test uses a util from devkit, but that util
// lives in the Nx package and creates the project graph,
// we need to mock the resolved value inside the Nx package

// Define mock BEFORE requiring the module
const mockCreateProjectGraphAsync = jest.fn().mockResolvedValue({
  nodes: {},
  dependencies: {},
});

jest.mock('nx/src/project-graph/project-graph', () => ({
  ...jest.requireActual('nx/src/project-graph/project-graph'),
  createProjectGraphAsync: mockCreateProjectGraphAsync,
}));

afterAll(() => {
  jest.restoreAllMocks();
});
