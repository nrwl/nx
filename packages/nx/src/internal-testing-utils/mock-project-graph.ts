import { jest } from '@jest/globals';

jest.doMock('@nx/devkit', () => ({
  ...jest.requireActual<any>('@nx/devkit'),
  createProjectGraphAsync: jest.fn().mockImplementation(async () => {
    return {
      nodes: {},
      dependencies: {},
    };
  }),
}));
