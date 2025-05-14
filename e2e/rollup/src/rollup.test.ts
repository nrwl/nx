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
} from '@nx/e2e/utils';

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
    checkFilesExist(`dist/libs/${myPkg}/index.cjs.d.ts`);
    expect(readJson(`dist/libs/${myPkg}/package.json`).exports).toEqual({
      '.': {
        module: './index.esm.js',
        import: './index.cjs.mjs',
        default: './index.cjs.js',
        types: './index.esm.d.ts',
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
    checkFilesExist(`dist/libs/${myPkg}/index.cjs.d.ts`);
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
        types: './index.esm.d.ts',
      },
      './bar': {
        module: './bar.esm.js',
        import: './bar.cjs.mjs',
        default: './bar.cjs.js',
        types: './bar.esm.d.ts',
      },
      './foo': {
        module: './foo.esm.js',
        import: './foo.cjs.mjs',
        default: './foo.cjs.js',
        types: './foo.esm.d.ts',
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
});
