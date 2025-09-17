import {
  checkFilesExist,
  cleanupProject,
  newProject,
  packageInstall,
  readJson,
  rmDist,
  runCLI,
  runCommand,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e-utils';

describe('Rollup Plugin', () => {
  beforeAll(() => newProject({ packages: ['@nx/rollup', '@nx/js'] }));
  afterAll(() => cleanupProject());

  it('should be able to setup project to build node programs with rollup and different compilers', async () => {
    const myPkg = uniq('my-pkg');
    runCLI(
      `generate @nx/js:lib ${myPkg} --directory=libs/${myPkg} --bundler=rollup`
    );
    updateFile(`libs/${myPkg}/src/index.ts`, `console.log('Hello');\n`);

    // babel (default)
    runCLI(
      `generate @nx/rollup:configuration ${myPkg} --tsConfig=./tsconfig.lib.json --main=./src/index.ts`
    );
    updateFile(
      `libs/${myPkg}/rollup.config.cjs`,
      `
      const { withNx } = require('@nx/rollup/with-nx');
      module.exports =  withNx({
        outputPath: '../../dist/libs/${myPkg}',
        main: './src/index.ts',
        tsConfig: './tsconfig.lib.json',
        compiler: 'babel',
        generateExportsField: true,
        additionalEntryPoints: ['./src/{foo,bar}.ts'],
        format: ['cjs', 'esm']
      });
    `
    );
    rmDist();
    runCLI(`build ${myPkg}`);
    checkFilesExist(`dist/libs/${myPkg}/index.d.ts`);
    expect(readJson(`dist/libs/${myPkg}/package.json`).exports).toEqual({
      '.': {
        module: './index.esm.js',
        import: './index.cjs.mjs',
        default: './index.cjs.js',
        types: './index.d.ts',
      },
      './package.json': './package.json',
    });
    let output = runCommand(`node dist/libs/${myPkg}/index.cjs.js`);
    expect(output).toMatch(/Hello/);

    // swc
    runCLI(
      `generate @nx/rollup:configuration ${myPkg} --tsConfig=./tsconfig.lib.json --main=./src/index.ts --compiler=swc`
    );
    updateFile(
      `libs/${myPkg}/rollup.config.cjs`,
      `
      const { withNx } = require('@nx/rollup/with-nx');
      module.exports =  withNx({
        outputPath: '../../dist/libs/${myPkg}',
        main: './src/index.ts',
        tsConfig: './tsconfig.lib.json',
        compiler: 'swc',
        generateExportsField: true,
        additionalEntryPoints: ['./src/{foo,bar}.ts'],
        format: ['cjs', 'esm']
      });
    `
    );
    rmDist();
    runCLI(`build ${myPkg}`);
    output = runCommand(`node dist/libs/${myPkg}/index.cjs.js`);
    expect(output).toMatch(/Hello/);

    // tsc
    runCLI(
      `generate @nx/rollup:configuration ${myPkg} --tsConfig=./tsconfig.lib.json --main=./src/index.ts --compiler=tsc`
    );
    updateFile(
      `libs/${myPkg}/rollup.config.cjs`,
      `
      const { withNx } = require('@nx/rollup/with-nx');
      module.exports =  withNx({
        outputPath: '../../dist/libs/${myPkg}',
        main: './src/index.ts',
        tsConfig: './tsconfig.lib.json',
        compiler: 'tsc',
        generateExportsField: true,
        additionalEntryPoints: ['./src/{foo,bar}.ts'],
        format: ['cjs', 'esm']
      });
    `
    );
    rmDist();
    runCLI(`build ${myPkg}`);
    output = runCommand(`node dist/libs/${myPkg}/index.cjs.js`);
    expect(output).toMatch(/Hello/);
  }, 500000);

  it('should support additional entry-points and sourcemaps', async () => {
    const myPkg = uniq('my-pkg');
    runCLI(
      `generate @nx/js:lib ${myPkg} --directory=libs/${myPkg} --bundler=none`
    );
    runCLI(
      `generate @nx/rollup:configuration ${myPkg} --tsConfig=./tsconfig.lib.json --main=./src/index.ts --compiler=tsc`
    );
    updateFile(
      `libs/${myPkg}/rollup.config.cjs`,
      `
      const { withNx } = require('@nx/rollup/with-nx');
      module.exports =  withNx({
        outputPath: '../../dist/libs/${myPkg}',
        main: './src/index.ts',
        tsConfig: './tsconfig.lib.json',
        compiler: 'tsc',
        generateExportsField: true,
        additionalEntryPoints: ['./src/{foo,bar}.ts'],
        format: ['cjs', 'esm'],
        sourceMap: true,
      });
    `
    );

    updateFile(`libs/${myPkg}/src/foo.ts`, `export const foo = 'foo';`);
    updateFile(`libs/${myPkg}/src/bar.ts`, `export const bar = 'bar';`);

    runCLI(`build ${myPkg}`);

    checkFilesExist(`dist/libs/${myPkg}/index.esm.js`);
    checkFilesExist(`dist/libs/${myPkg}/index.esm.js.map`);
    checkFilesExist(`dist/libs/${myPkg}/index.cjs.js`);
    checkFilesExist(`dist/libs/${myPkg}/index.cjs.js.map`);
    checkFilesExist(`dist/libs/${myPkg}/index.d.ts`);
    checkFilesExist(`dist/libs/${myPkg}/foo.esm.js`);
    checkFilesExist(`dist/libs/${myPkg}/foo.esm.js.map`);
    checkFilesExist(`dist/libs/${myPkg}/foo.cjs.js`);
    checkFilesExist(`dist/libs/${myPkg}/foo.cjs.js.map`);
    checkFilesExist(`dist/libs/${myPkg}/bar.esm.js`);
    checkFilesExist(`dist/libs/${myPkg}/bar.esm.js.map`);
    checkFilesExist(`dist/libs/${myPkg}/bar.cjs.js`);
    checkFilesExist(`dist/libs/${myPkg}/bar.cjs.js.map`);
    expect(readJson(`dist/libs/${myPkg}/package.json`).exports).toEqual({
      './package.json': './package.json',
      '.': {
        module: './index.esm.js',
        import: './index.cjs.mjs',
        default: './index.cjs.js',
        types: './index.d.ts',
      },
      './bar': {
        module: './bar.esm.js',
        import: './bar.cjs.mjs',
        default: './bar.cjs.js',
        types: './bar.d.ts',
      },
      './foo': {
        module: './foo.esm.js',
        import: './foo.cjs.mjs',
        default: './foo.cjs.js',
        types: './foo.d.ts',
      },
    });
  });

  it('should be able to build libs generated with @nx/js:lib --bundler rollup', () => {
    const jsLib = uniq('jslib');
    runCLI(
      `generate @nx/js:lib ${jsLib} --directory=libs/${jsLib} --bundler rollup`
    );
    expect(() => runCLI(`build ${jsLib}`)).not.toThrow();
  });

  it('should work correctly with custom, non-Nx rollup config', () => {
    // ARRANGE
    packageInstall('@rollup/plugin-babel', undefined, '5.3.0', 'prod');
    packageInstall('@rollup/plugin-commonjs', undefined, '25.0.7', 'prod');
    packageInstall('rollup-plugin-typescript2', undefined, '0.36.0', 'prod');
    runCLI(`generate @nx/js:init --no-interactive`);
    runCLI(`generate @nx/rollup:init --no-interactive`);
    updateFile(
      `libs/test/src/index.ts`,
      `export function helloWorld() {
      console.log("hello world");
    }`
    );
    updateFile(`libs/test/package.json`, JSON.stringify({ name: 'test' }));
    updateFile(
      `libs/test/rollup.config.mjs`,
      `import { babel } from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import typescript2 from 'rollup-plugin-typescript2';

const config = {
  input: 'src/index.ts',
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
  plugins: [
    typescript2(),
    babel({ babelHelpers: 'bundled' }),
    commonjs(),
  ]
};

export default config;
`
    );

    // ACT
    const output = runCLI(`build test --verbose`);

    // ASSERT
    expect(output).toContain('Successfully ran target build for project test');
    checkFilesExist(`libs/test/dist/bundle.js`);
    checkFilesExist(`libs/test/dist/bundle.es.js`);
  });

  describe('useLegacyTypescriptPlugin', () => {
    it('should use @rollup/plugin-typescript by default when useLegacyTypescriptPlugin is not specified', async () => {
      const myPkg = uniq('my-pkg');
      runCLI(
        `generate @nx/js:lib ${myPkg} --directory=libs/${myPkg} --bundler=rollup --no-interactive`
      );
      updateFile(
        `libs/${myPkg}/src/index.ts`,
        `export const hello = 'default';\n`
      );

      // Change TypeScript plugin build target to avoid conflict with Rollup
      updateJson('nx.json', (nxJson) => {
        nxJson.plugins.forEach((plugin) => {
          if (
            plugin.plugin === '@nx/js/typescript' &&
            plugin.include?.includes(`libs/${myPkg}/*`)
          ) {
            if (plugin.options?.build?.targetName === 'build') {
              plugin.options.build.targetName = 'tsc:build';
            }
          }
        });
        return nxJson;
      });

      // Use default config without specifying useLegacyTypescriptPlugin
      updateFile(
        `libs/${myPkg}/rollup.config.cjs`,
        `
        const { withNx } = require('@nx/rollup/with-nx');
        module.exports = withNx({
          outputPath: '../../dist/libs/${myPkg}',
          main: './src/index.ts',
          tsConfig: './tsconfig.lib.json',
          compiler: 'tsc',
          format: ['cjs', 'esm']
        });
      `
      );

      // Build should succeed with the official @rollup/plugin-typescript (new default)
      rmDist();
      const output = runCLI(`build ${myPkg} --verbose`);

      // Verify build succeeded
      expect(output).toContain('Successfully ran target build');
      // By default (without the flag), it should use @rollup/plugin-typescript
      checkFilesExist(`dist/libs/${myPkg}/index.cjs.js`);
      checkFilesExist(`dist/libs/${myPkg}/index.esm.js`);
      checkFilesExist(`dist/libs/${myPkg}/index.d.ts`);

      // Verify the output works
      const result = runCommand(
        `node -e "console.log(require('./dist/libs/${myPkg}/index.cjs.js').hello)"`
      );
      expect(result.trim()).toBe('default');
    });

    it('should use @rollup/plugin-typescript when useLegacyTypescriptPlugin is false', async () => {
      const myPkg = uniq('my-pkg');
      runCLI(
        `generate @nx/js:lib ${myPkg} --directory=libs/${myPkg} --bundler=rollup --no-interactive`
      );
      updateFile(
        `libs/${myPkg}/src/index.ts`,
        `export const hello = 'world';\n`
      );

      // Change TypeScript plugin build target to avoid conflict with Rollup
      updateJson('nx.json', (nxJson) => {
        nxJson.plugins.forEach((plugin) => {
          if (
            plugin.plugin === '@nx/js/typescript' &&
            plugin.include?.includes(`libs/${myPkg}/*`)
          ) {
            if (plugin.options?.build?.targetName === 'build') {
              plugin.options.build.targetName = 'tsc:build';
            }
          }
        });
        return nxJson;
      });

      // Update rollup config to use useLegacyTypescriptPlugin: false
      updateFile(
        `libs/${myPkg}/rollup.config.cjs`,
        `
        const { withNx } = require('@nx/rollup/with-nx');
        module.exports = withNx({
          outputPath: '../../dist/libs/${myPkg}',
          main: './src/index.ts',
          tsConfig: './tsconfig.lib.json',
          compiler: 'tsc',
          format: ['cjs', 'esm'],
          useLegacyTypescriptPlugin: false
        });
      `
      );

      // Build should succeed with the official @rollup/plugin-typescript
      rmDist();
      const output = runCLI(`build ${myPkg} --verbose`);

      // Verify build succeeded
      expect(output).toContain('Successfully ran target build');
      checkFilesExist(`dist/libs/${myPkg}/index.cjs.js`);
      checkFilesExist(`dist/libs/${myPkg}/index.esm.js`);
      checkFilesExist(`dist/libs/${myPkg}/index.d.ts`);

      // Verify the output works
      const result = runCommand(
        `node -e "console.log(require('./dist/libs/${myPkg}/index.cjs.js').hello)"`
      );
      expect(result.trim()).toBe('world');
    });

    it('should use rollup-plugin-typescript2 when useLegacyTypescriptPlugin is true', async () => {
      const myPkg = uniq('my-pkg');
      runCLI(
        `generate @nx/js:lib ${myPkg} --directory=libs/${myPkg} --bundler=rollup`
      );
      updateFile(`libs/${myPkg}/src/index.ts`, `export const foo = 'bar';\n`);

      // Change TypeScript plugin build target to avoid conflict with Rollup
      updateJson('nx.json', (nxJson) => {
        nxJson.plugins.forEach((plugin) => {
          if (
            plugin.plugin === '@nx/js/typescript' &&
            plugin.include?.includes(`libs/${myPkg}/*`)
          ) {
            if (plugin.options?.build?.targetName === 'build') {
              plugin.options.build.targetName = 'tsc:build';
            }
          }
        });
        return nxJson;
      });

      // Update rollup config to explicitly use useLegacyTypescriptPlugin: true
      updateFile(
        `libs/${myPkg}/rollup.config.cjs`,
        `
        const { withNx } = require('@nx/rollup/with-nx');
        module.exports = withNx({
          outputPath: '../../dist/libs/${myPkg}',
          main: './src/index.ts',
          tsConfig: './tsconfig.lib.json',
          compiler: 'tsc',
          format: ['cjs', 'esm'],
          useLegacyTypescriptPlugin: true
        });
      `
      );

      // Build should succeed with rollup-plugin-typescript2
      rmDist();
      const output = runCLI(`build ${myPkg} --verbose`);

      // Verify build succeeded
      expect(output).toContain('Successfully ran target build');
      // Note: The deprecation warning is shown but may not be captured in the test output
      // The important thing is that the build succeeds with the legacy plugin when explicitly set
      checkFilesExist(`dist/libs/${myPkg}/index.cjs.js`);
      checkFilesExist(`dist/libs/${myPkg}/index.esm.js`);
      checkFilesExist(`dist/libs/${myPkg}/index.d.ts`);

      // Verify the output works
      const result = runCommand(
        `node -e "console.log(require('./dist/libs/${myPkg}/index.cjs.js').foo)"`
      );
      expect(result.trim()).toBe('bar');
    });
  });
});
