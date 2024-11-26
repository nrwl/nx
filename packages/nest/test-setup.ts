// If a test uses a util from devkit, but that util
// lives in the Nx package and creates the project graph,
// we need to mock the resolved value inside the Nx package
jest
  .spyOn(
    require('nx/src/project-graph/project-graph'),
    'createProjectGraphAsync'
  )
  .mockResolvedValue({
    nodes: {},
    dependencies: {},
  });
