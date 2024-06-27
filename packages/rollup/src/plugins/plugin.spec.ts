import { type CreateNodesContext } from '@nx/devkit';
import { createNodes } from './plugin';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';

// Jest 29 does not support dynamic import() unless --experimental-vm-modules is set.
// For now, we will mock the loadConfigFile function. We should remove this once we upgrade to Jest 30.
jest.mock('rollup/loadConfigFile', () => {
  return {
    loadConfigFile: jest.fn(),
  };
});

describe('@nx/rollup/plugin', () => {
  let createNodesFunction = createNodes[1];
  let context: CreateNodesContext;
  let cwd = process.cwd();

  describe('root project', () => {
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
        configFiles: [],
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
        'rollup.config.js',
        JSON.stringify(rollupConfigOptions)
      );
      tempFs.createFileSync('package.json', JSON.stringify({ name: 'mylib' }));
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
        'rollup.config.js',
        {
          buildTargetName: 'build',
        },
        context
      );

      // ASSERT
      expect(nodes).toMatchSnapshot();
    });
  });

  describe('non-root project', () => {
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
        configFiles: [],
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
        'mylib/rollup.config.js',
        JSON.stringify(rollupConfigOptions)
      );
      tempFs.createFileSync(
        'mylib/package.json',
        JSON.stringify({ name: 'mylib' })
      );
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
        'mylib/rollup.config.js',
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
