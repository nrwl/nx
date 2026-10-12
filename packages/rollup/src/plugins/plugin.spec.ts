import { type CreateNodesContext } from '@nx/devkit';
import { createNodesV2 } from './plugin';
import { mockCjsModule, TempFs } from '@nx/devkit/internal-testing-utils';

// The plugin `require`s rollup/loadConfigFile, which `vi.mock` cannot reach.
const loadConfigFile = vi.fn();
mockCjsModule(import.meta.url, 'rollup/loadConfigFile', { loadConfigFile });

// Mock getPackageManagerCommand to ensure consistent test environment
vi.mock('@nx/devkit', async () => ({
  ...(await vi.importActual<any>('@nx/devkit')),
  getPackageManagerCommand: vi.fn(() => ({
    exec: 'npx',
  })),
}));

// Mock isUsingTsSolutionSetup to ensure consistent test environment
vi.mock('@nx/js/internal', async () => ({
  ...(await vi.importActual<any>('@nx/js/internal')),
  isUsingTsSolutionSetup: vi.fn(() => false),
}));

describe('@nx/rollup/plugin', () => {
  let createNodesFunction = createNodesV2[1];
  let context: CreateNodesContext;
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

      loadConfigFile.mockReturnValue(rollupConfigOptions);

      process.chdir(tempFs.tempDir);
    });

    afterEach(() => {
      vi.resetModules();
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

      loadConfigFile.mockReturnValue(rollupConfigOptions);

      process.chdir(tempFs.tempDir);
    });

    afterEach(() => {
      vi.resetModules();
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
