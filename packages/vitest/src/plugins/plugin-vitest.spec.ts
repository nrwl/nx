import { CreateNodesContext } from '@nx/devkit';
import { readFile } from 'node:fs/promises';
import { glob } from 'tinyglobby';
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

// Default enumeration path globs test files instead of booting Vitest.
// Return the files unsorted to also exercise the plugin's sort.
jest.mock('tinyglobby', () => ({
  glob: jest.fn().mockResolvedValue(['src/test-2.ts', 'src/test-1.ts']),
}));

jest.mock('node:fs/promises', () => ({
  ...jest.requireActual('node:fs/promises'),
  readFile: jest.fn(),
}));

// Mock readJsonFile from @nx/devkit to return stable project name
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  detectPackageManager: jest.fn().mockReturnValue('npm'),
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
  loadVitestConfigDynamicImport: jest.fn().mockResolvedValue({
    configDefaults: {
      include: ['**/*.{test,spec}.?(c|m)[jt]s?(x)'],
      exclude: ['**/node_modules/**', '**/.git/**'],
      typecheck: {
        include: ['**/*.{test,spec}-d.?(c|m)[jt]s?(x)'],
        exclude: ['**/node_modules/**', '**/.git/**'],
      },
    },
  }),
}));

describe('@nx/vitest', () => {
  let createNodesFunction = createNodesV2[1];
  let context: CreateNodesContext;

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

    it('should sort atomized target names when test discovery returns shuffled paths', async () => {
      // tinyglobby does not sort its filesystem walk output. Simulate that by
      // returning paths in non-alphabetic order; the plugin must sort them so
      // atomized target insertion order is stable across runs.
      (glob as jest.Mock).mockResolvedValueOnce([
        'src/c.test.ts',
        'src/a.test.ts',
        'src/b.test.ts',
      ]);

      const nodes = await createNodesFunction(
        ['vitest.config.ts'],
        { testTargetName: 'test', ciTargetName: 'test-ci' },
        context
      );

      const targets = nodes[0][1].projects!['.'].targets!;
      const atomizedTargetNames = Object.keys(targets).filter((name) =>
        name.startsWith('test-ci--')
      );
      expect(atomizedTargetNames).toEqual([
        'test-ci--src/a.test.ts',
        'test-ci--src/b.test.ts',
        'test-ci--src/c.test.ts',
      ]);

      // dependsOn and target group ordering must agree with insertion order.
      const dependsOn = (targets['test-ci'].dependsOn as string[]).filter(
        (d: string) => d.startsWith('test-ci--')
      );
      expect(dependsOn).toEqual([
        'test-ci--src/a.test.ts',
        'test-ci--src/b.test.ts',
        'test-ci--src/c.test.ts',
      ]);
    });
  });

  describe('typecheck enabled', () => {
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

    it('should include d.ts in dependentTasksOutputFiles when typecheck is enabled', async () => {
      (loadViteDynamicImport as jest.Mock).mockResolvedValueOnce({
        resolveConfig: jest.fn().mockResolvedValue({
          path: 'vitest.config.ts',
          config: {},
          dependencies: [],
          test: {
            typecheck: {
              enabled: true,
            },
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

      const testTarget = nodes[0][1].projects['.'].targets['test'];
      expect(testTarget.inputs).toContainEqual({
        dependentTasksOutputFiles: '**/*.{js,d.ts}',
        transitive: true,
      });
    });

    it('should only include js in dependentTasksOutputFiles when typecheck is not enabled', async () => {
      const nodes = await createNodesFunction(
        ['vitest.config.ts'],
        {
          testTargetName: 'test',
        },
        context
      );

      const testTarget = nodes[0][1].projects['.'].targets['test'];
      expect(testTarget.inputs).toContainEqual({
        dependentTasksOutputFiles: '**/*.js',
        transitive: true,
      });
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

    it('should NOT create a project for root config with projects array', async () => {
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

      // The root orchestrator config is not a project; it must not register a
      // node rooted at the workspace root (which would make `nx format` and
      // affected detection treat the whole workspace as one project).
      expect(nodes[0][1].projects).toEqual({});
    });

    it('should NOT create a project for root config with empty projects array', async () => {
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

      expect(nodes[0][1].projects).toEqual({});
    });
  });

  describe('atomized test discovery', () => {
    beforeEach(() => {
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
      (glob as jest.Mock).mockClear();
      (readFile as jest.Mock).mockReset();
    });

    afterEach(() => {
      jest.resetModules();
    });

    it('should glob test files instead of booting Vitest for a glob-safe config', async () => {
      (glob as jest.Mock).mockResolvedValueOnce(['src/from-glob.spec.ts']);

      const nodes = await createNodesFunction(
        ['vitest.config.ts'],
        { testTargetName: 'test', ciTargetName: 'test-ci' },
        context
      );

      const targets = nodes[0][1].projects!['.'].targets!;
      expect(targets['test-ci--src/from-glob.spec.ts']).toBeDefined();
      expect(glob).toHaveBeenCalled();
    });

    it('should fall back to Vitest when a plugin exposes configureVitest', async () => {
      (loadViteDynamicImport as jest.Mock).mockResolvedValueOnce({
        resolveConfig: jest.fn().mockResolvedValue({
          path: 'vitest.config.ts',
          config: {},
          dependencies: [],
          plugins: [{ name: 'inject', configureVitest() {} }],
        }),
      });

      const nodes = await createNodesFunction(
        ['vitest.config.ts'],
        { testTargetName: 'test', ciTargetName: 'test-ci' },
        context
      );

      const targets = nodes[0][1].projects!['.'].targets!;
      // Comes from the createVitest mock, not the glob.
      expect(targets['test-ci--src/test-1.ts']).toBeDefined();
      expect(targets['test-ci--src/test-2.ts']).toBeDefined();
      expect(glob).not.toHaveBeenCalled();
    });

    it('should always use Vitest when disableVitestRuntime is false', async () => {
      const nodes = await createNodesFunction(
        ['vitest.config.ts'],
        {
          testTargetName: 'test',
          ciTargetName: 'test-ci',
          disableVitestRuntime: false,
        },
        context
      );

      const targets = nodes[0][1].projects!['.'].targets!;
      expect(targets['test-ci--src/test-1.ts']).toBeDefined();
      expect(targets['test-ci--src/test-2.ts']).toBeDefined();
      expect(glob).not.toHaveBeenCalled();
    });

    it('should also glob type tests when typecheck is enabled', async () => {
      (loadViteDynamicImport as jest.Mock).mockResolvedValueOnce({
        resolveConfig: jest.fn().mockResolvedValue({
          path: 'vitest.config.ts',
          config: {},
          dependencies: [],
          test: { typecheck: { enabled: true } },
        }),
      });
      (glob as jest.Mock)
        .mockResolvedValueOnce(['src/a.spec.ts'])
        .mockResolvedValueOnce(['src/a.test-d.ts']);

      const nodes = await createNodesFunction(
        ['vitest.config.ts'],
        { testTargetName: 'test', ciTargetName: 'test-ci' },
        context
      );

      const targets = nodes[0][1].projects!['.'].targets!;
      expect(targets['test-ci--src/a.spec.ts']).toBeDefined();
      expect(targets['test-ci--src/a.test-d.ts']).toBeDefined();
      // The type-test glob runs with Vitest's typecheck include default.
      expect(glob).toHaveBeenCalledWith(
        ['**/*.{test,spec}-d.?(c|m)[jt]s?(x)'],
        expect.objectContaining({ cwd: '.' })
      );
    });

    it.each([
      ['test.workspace', { workspace: ['pkg-a'] }],
      ['test.changed', { changed: true }],
      ['test.related', { related: ['src/a.ts'] }],
    ])(
      'should fall back to Vitest when %s is set',
      async (_label, testConfig) => {
        (loadViteDynamicImport as jest.Mock).mockResolvedValueOnce({
          resolveConfig: jest.fn().mockResolvedValue({
            path: 'vitest.config.ts',
            config: {},
            dependencies: [],
            test: testConfig,
          }),
        });

        const nodes = await createNodesFunction(
          ['vitest.config.ts'],
          { testTargetName: 'test', ciTargetName: 'test-ci' },
          context
        );

        const targets = nodes[0][1].projects!['.'].targets!;
        expect(targets['test-ci--src/test-1.ts']).toBeDefined();
        expect(glob).not.toHaveBeenCalled();
      }
    );

    it('should honor a config include/exclude over Vitest defaults', async () => {
      (loadViteDynamicImport as jest.Mock).mockResolvedValueOnce({
        resolveConfig: jest.fn().mockResolvedValue({
          path: 'vitest.config.ts',
          config: {},
          dependencies: [],
          test: {
            include: ['custom/**/*.spec.ts'],
            exclude: ['**/skip/**'],
          },
        }),
      });
      (glob as jest.Mock).mockResolvedValueOnce(['custom/a.spec.ts']);

      const nodes = await createNodesFunction(
        ['vitest.config.ts'],
        { testTargetName: 'test', ciTargetName: 'test-ci' },
        context
      );

      expect(glob).toHaveBeenCalledWith(
        ['custom/**/*.spec.ts'],
        expect.objectContaining({ ignore: ['**/skip/**'] })
      );
      const targets = nodes[0][1].projects!['.'].targets!;
      expect(targets['test-ci--custom/a.spec.ts']).toBeDefined();
    });

    it('should keep only in-source files that contain the vitest marker', async () => {
      (loadViteDynamicImport as jest.Mock).mockResolvedValueOnce({
        resolveConfig: jest.fn().mockResolvedValue({
          path: 'vitest.config.ts',
          config: {},
          dependencies: [],
          test: { includeSource: ['src/**/*.ts'] },
        }),
      });
      (glob as jest.Mock)
        .mockResolvedValueOnce([]) // regular include
        .mockResolvedValueOnce(['src/a.ts', 'src/b.ts']); // includeSource
      (readFile as jest.Mock)
        .mockResolvedValueOnce('export const x = 1;')
        .mockResolvedValueOnce('if (import.meta.vitest) { /* test */ }');

      const nodes = await createNodesFunction(
        ['vitest.config.ts'],
        { testTargetName: 'test', ciTargetName: 'test-ci' },
        context
      );

      const targets = nodes[0][1].projects!['.'].targets!;
      expect(targets['test-ci--src/b.ts']).toBeDefined();
      expect(targets['test-ci--src/a.ts']).toBeUndefined();
    });

    it('should skip in-source candidates that cannot be read', async () => {
      (loadViteDynamicImport as jest.Mock).mockResolvedValueOnce({
        resolveConfig: jest.fn().mockResolvedValue({
          path: 'vitest.config.ts',
          config: {},
          dependencies: [],
          test: { includeSource: ['src/**/*.ts'] },
        }),
      });
      (glob as jest.Mock)
        .mockResolvedValueOnce([]) // regular include
        .mockResolvedValueOnce(['src/unreadable.ts']); // includeSource
      (readFile as jest.Mock).mockRejectedValueOnce(
        Object.assign(new Error('EACCES'), { code: 'EACCES' })
      );

      // An unreadable file must not throw out of graph creation.
      const nodes = await createNodesFunction(
        ['vitest.config.ts'],
        { testTargetName: 'test', ciTargetName: 'test-ci' },
        context
      );

      const targets = nodes[0][1].projects!['.'].targets!;
      expect(targets['test-ci--src/unreadable.ts']).toBeUndefined();
    });

    it('should drop test files that escape the project root', async () => {
      (glob as jest.Mock).mockResolvedValueOnce([
        '../outside.spec.ts',
        'src/inside.spec.ts',
      ]);

      const nodes = await createNodesFunction(
        ['vitest.config.ts'],
        { testTargetName: 'test', ciTargetName: 'test-ci' },
        context
      );

      const targets = nodes[0][1].projects!['.'].targets!;
      expect(targets['test-ci--src/inside.spec.ts']).toBeDefined();
      expect(Object.keys(targets).some((name) => name.includes('..'))).toBe(
        false
      );
    });
  });
});
