import { type CreateNodesContextV2 } from '@nx/devkit';
import { createNodesV2 } from './plugin';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';

// Jest 29 does not support dynamic import() unless --experimental-vm-modules is set.
// For now, we will mock the loadConfigFile function. We should remove this once we upgrade to Jest 30.
jest.mock('rollup/loadConfigFile', () => {
  return {
    loadConfigFile: jest.fn(),
  };
});

// Mock getPackageManagerCommand to ensure consistent test environment
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  getPackageManagerCommand: jest.fn(() => ({
    exec: 'npx',
  })),
}));

// Mock isUsingTsSolutionSetup to ensure consistent test environment
jest.mock('@nx/js/internal', () => ({
  ...jest.requireActual('@nx/js/internal'),
  isUsingTsSolutionSetup: jest.fn(() => false),
}));

describe('@nx/rollup/plugin', () => {
  let createNodesFunction = createNodesV2[1];
  let context: CreateNodesContextV2;
  let cwd = process.cwd();
  let originalCacheProjectGraph = process.env.NX_CACHE_PROJECT_GRAPH;

  beforeEach(() => {
    process.env.NX_CACHE_PROJECT_GRAPH = 'false';
  });

  afterEach(() => {
    if (originalCacheProjectGraph !== undefined) {
      process.env.NX_CACHE_PROJECT_GRAPH = originalCacheProjectGraph;
    } else {
      delete process.env.NX_CACHE_PROJECT_GRAPH;
    }
  });

  describe.each(['js', 'ts'])('root project', (extname) => {
    const tempFs = new TempFs('test');

    beforeEach(() => {
      context = {
        nxJsonConfiguration: {
          targetDefaults: {
            build: {
              cache: false,
              inputs: ['foo', '^foo'],
            },
          },
          namedInputs: {
            default: ['{projectRoot}/**/*'],
            production: ['!{projectRoot}/**/*.spec.ts'],
          },
        },
        workspaceRoot: tempFs.tempDir,
      };
      const rollupConfigOptions = {
        options: [
          {
            output: {
              file: 'dist/bundle.js',
              format: 'cjs',
              sourcemap: true,
            },
          },
        ],
      };

      // This isn't JS, but all that really matters here
      // is that the hash is different after updating the
      // config file. The actual config read is mocked below.
      tempFs.createFileSync(
        `rollup.config.c${extname}`,
        JSON.stringify(rollupConfigOptions)
      );
      tempFs.createFileSync('package.json', JSON.stringify({ name: 'mylib' }));
      tempFs.createFileSync('package-lock.json', '{}');
      tempFs.createFileSync(
        'src/index.js',
        `export function main() { 
      console.log("hello world");
      }`
      );

      const { loadConfigFile } = require('rollup/loadConfigFile');
      loadConfigFile.mockReturnValue(rollupConfigOptions);

      process.chdir(tempFs.tempDir);
    });

    afterEach(() => {
      jest.resetModules();
      tempFs.cleanup();
      process.chdir(cwd);
    });

    it('should create nodes', async () => {
      // ACT
      const nodes = await createNodesFunction(
        [`rollup.config.c${extname}`],
        {
          buildTargetName: 'build',
        },
        context
      );

      // ASSERT
      expect(nodes).toMatchSnapshot();
    });
  });

  describe.each(['js', 'ts'])('non-root project', (extname) => {
    const tempFs = new TempFs('test');

    beforeEach(() => {
      context = {
        nxJsonConfiguration: {
          namedInputs: {
            default: ['{projectRoot}/**/*'],
            production: ['!{projectRoot}/**/*.spec.ts'],
          },
        },
        workspaceRoot: tempFs.tempDir,
      };
      const rollupConfigOptions = {
        options: [
          {
            output: {
              file: 'build/bundle.js',
              format: 'cjs',
              sourcemap: true,
            },
          },
          {
            output: {
              file: 'dist/bundle.es.js',
              format: 'es',
              sourcemap: true,
            },
          },
        ],
      };

      // This isn't JS, but all that really matters here
      // is that the hash is different after updating the
      // config file. The actual config read is mocked below.
      tempFs.createFileSync(
        `mylib/rollup.config.c${extname}`,
        JSON.stringify(rollupConfigOptions)
      );
      tempFs.createFileSync(
        'mylib/package.json',
        JSON.stringify({ name: 'mylib' })
      );
      tempFs.createFileSync('package-lock.json', '{}');
      tempFs.createFileSync(
        'mylib/src/index.js',
        `export function main() { 
      console.log("hello world");
      }`
      );

      const { loadConfigFile } = require('rollup/loadConfigFile');
      loadConfigFile.mockReturnValue(rollupConfigOptions);

      process.chdir(tempFs.tempDir);
    });

    afterEach(() => {
      jest.resetModules();
      tempFs.cleanup();
      process.chdir(cwd);
    });

    it('should create nodes', async () => {
      // ACT
      const nodes = await createNodesFunction(
        [`mylib/rollup.config.c${extname}`],
        {
          buildTargetName: 'build',
        },
        context
      );

      // ASSERT
      expect(nodes).toMatchSnapshot();
    });
  });
});
