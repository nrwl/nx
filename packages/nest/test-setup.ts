// If a test uses a util from devkit, but that util
// lives in the Nx package and creates the project graph,
// we need to mock the resolved value inside the Nx package
jest.mock('nx/src/project-graph/project-graph', () => ({
  ...jest.requireActual('nx/src/project-graph/project-graph'),
  createProjectGraphAsync: jest.fn().mockResolvedValue({
    nodes: {},
    dependencies: {},
  }),
}));
