import { CreateNodesContext } from '@nx/devkit';
import { createNodesV2 } from './plugin';

// Mock fs to provide stable test environment
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readdirSync: jest.fn(() => [
    'package.json',
    'vitest.config.ts',
    'tsconfig.lib.json',
  ]),
  existsSync: jest.fn((path) => {
    if (path.endsWith('package.json') || path.endsWith('project.json')) {
      return true;
    }
    return false;
  }),
}));

// Mock readJsonFile from @nx/devkit to return stable project name
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  readJsonFile: jest.fn((path) => {
    if (path.endsWith('package.json')) {
      return { name: 'vite' };
    }
    if (path.endsWith('project.json')) {
      return { name: 'vite' };
    }
    return {};
  }),
}));

jest.mock('vite', () => ({
  resolveConfig: jest.fn().mockImplementation(() => {
    return Promise.resolve({
      path: 'vitest.config.ts',
      config: {},
      dependencies: [],
    });
  }),
}));

jest.mock('../utils/executor-utils', () => ({
  loadViteDynamicImport: jest.fn().mockResolvedValue({
    resolveConfig: jest.fn().mockResolvedValue({
      path: 'vitest.config.ts',
      config: {},
      dependencies: [],
    }),
  }),
}));

describe('@nx/vite/plugin', () => {
  let createNodesFunction = createNodesV2[1];
  let context: CreateNodesContext;
  describe('root project', () => {
    beforeEach(async () => {
      context = {
        configFiles: [],
        nxJsonConfiguration: {
          targetDefaults: {},
          namedInputs: {
            default: ['{projectRoot}/**/*'],
            production: ['!{projectRoot}/**/*.spec.ts'],
          },
        },
        workspaceRoot: '',
      };
    });

    afterEach(() => {
      jest.resetModules();
    });

    it('should create nodes', async () => {
      const nodes = await createNodesFunction(
        ['vitest.config.ts'],
        {
          testTargetName: 'test',
        },
        context
      );

      expect(nodes).toMatchSnapshot();
    });
  });
});
