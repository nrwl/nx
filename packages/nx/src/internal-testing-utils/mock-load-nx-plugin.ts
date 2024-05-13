jest.mock('nx/src/project-graph/plugins/loader', () => ({
  ...jest.requireActual('nx/src/project-graph/plugins/loader'),
  loadNxPlugin: jest.fn().mockImplementation(() => {
    return [Promise.resolve({}), () => {}];
  }),
}));
