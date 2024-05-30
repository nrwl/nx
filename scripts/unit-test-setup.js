module.exports = () => {
  process.env.NX_DAEMON = 'false';

  // Prevents tests from relying on the Nx repo project graph
  jest.doMock('@nx/devkit', () => ({
    ...jest.requireActual('@nx/devkit'),
    createProjectGraphAsync: jest.fn().mockImplementation(async () => {
      return {
        nodes: {},
        dependencies: {},
      };
    }),
  }));
};
