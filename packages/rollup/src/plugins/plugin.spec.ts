import { type CreateNodesContext, joinPathFragments } from '@nx/devkit';
import { createNodes } from './plugin';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';

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

      tempFs.createFileSync('package.json', JSON.stringify({ name: 'mylib' }));
      tempFs.createFileSync(
        'src/index.js',
        `export function main() { 
      console.log("hello world");
      }`
      );
      tempFs.createFileSync(
        'rollup.config.js',
        `
const config = {
  input: 'src/index.js',
  output: [
    {
      file: 'dist/bundle.js',
      format: 'cjs',
      sourcemap: true
    },
    {
      file: 'dist/bundle.es.js',
      format: 'es',
      sourcemap: true
    }
  ],
  plugins: [],
};

module.exports = config;
      `
      );

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
      tempFs.createFileSync(
        'mylib/rollup.config.js',
        `
const config = {
  input: 'src/index.js',
  output: [
    {
      file: 'build/bundle.js',
      format: 'cjs',
      sourcemap: true
    },
    {
      file: 'dist/bundle.es.js',
      format: 'es',
      sourcemap: true
    }
  ],
  plugins: [],
};

module.exports = config;
      `
      );

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
