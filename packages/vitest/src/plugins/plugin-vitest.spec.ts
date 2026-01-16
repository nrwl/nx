import { CreateNodesContextV2 } from '@nx/devkit';
import { createNodesV2 } from './plugin';
import { loadViteDynamicImport } from '../utils/executor-utils';

// Mock fs to provide stable test environment
jest.mock('node:fs', () => ({
  ...jest.requireActual('node:fs'),
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

jest.mock('vitest/node', () => ({
  createVitest: jest.fn().mockImplementation(() => {
    return {
      getRelevantTestSpecifications: jest.fn().mockResolvedValue([
        {
          moduleId: 'src/test-1.ts',
        },
        {
          moduleId: 'src/test-2.ts',
        },
      ]),
    };
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

describe('@nx/vitest', () => {
  let createNodesFunction = createNodesV2[1];
  let context: CreateNodesContextV2;

  describe('root project', () => {
    beforeEach(async () => {
      context = {
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

    it('should create nodes with ci target name', async () => {
      const nodes = await createNodesFunction(
        ['vitest.config.ts'],
        {
          testTargetName: 'test',
          ciTargetName: 'e2e-ci',
        },
        context
      );

      expect(nodes).toMatchSnapshot();
    });

    it('should create nodes with ci target name and ci group name', async () => {
      const nodes = await createNodesFunction(
        ['vitest.config.ts'],
        {
          testTargetName: 'test',
          ciTargetName: 'e2e-ci',
          ciGroupName: 'Custom E2E (CI)',
        },
        context
      );

      expect(nodes).toMatchSnapshot();
    });
  });

  describe('workspace config with projects', () => {
    beforeEach(async () => {
      context = {
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

    it('should NOT create targets for root config with projects array', async () => {
      (loadViteDynamicImport as jest.Mock).mockResolvedValueOnce({
        resolveConfig: jest.fn().mockResolvedValue({
          path: 'vitest.config.ts',
          config: {},
          dependencies: [],
          test: {
            projects: ['packages/*'],
          },
        }),
      });

      const nodes = await createNodesFunction(
        ['vitest.config.ts'],
        {
          testTargetName: 'test',
        },
        context
      );

      // Root config with projects should return empty targets
      expect(nodes[0][1].projects['.']).toMatchObject({
        targets: {},
        metadata: {},
        projectType: 'library',
      });
    });

    it('should NOT create targets for root config with empty projects array', async () => {
      (loadViteDynamicImport as jest.Mock).mockResolvedValueOnce({
        resolveConfig: jest.fn().mockResolvedValue({
          path: 'vitest.config.ts',
          config: {},
          dependencies: [],
          test: {
            projects: [],
          },
        }),
      });

      const nodes = await createNodesFunction(
        ['vitest.config.ts'],
        {
          testTargetName: 'test',
        },
        context
      );

      // Root config with empty projects array should also return empty targets
      expect(nodes[0][1].projects['.']).toMatchObject({
        targets: {},
        metadata: {},
        projectType: 'library',
      });
    });
  });
});
