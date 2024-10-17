import {
  updateJson,
  cleanupProject,
  newProject,
  runCLI,
  tmpProjPath,
  runCommand,
  createFile,
  uniq,
  getPackageManagerCommand,
  readJson,
  updateFile,
  renameFile,
} from '@nx/e2e/utils';
import { join } from 'path';

describe('packaging libs', () => {
  let scope: string;

  beforeEach(() => {
    scope = newProject();
  });

  afterEach(() => cleanupProject());

  // TODO: investigate this failure
  xit('should bundle libs using esbuild, vite, rollup and be used in CJS/ESM projects', () => {
    const esbuildLib = uniq('esbuildlib');
    const viteLib = uniq('vitelib');
    const rollupLib = uniq('rolluplib');

    runCLI(
      `generate @nx/js:lib libs/${esbuildLib} --bundler=esbuild --no-interactive`
    );
    runCLI(
      `generate @nx/js:lib libs/${viteLib} --bundler=vite --no-interactive`
    );
    runCLI(
      `generate @nx/js:lib libs/${rollupLib} --bundler=rollup --no-interactive`
    );
    updateFile(`libs/${rollupLib}/src/index.ts`, (content) => {
      // Test that default functions work in ESM (Node).
      return `${content}\nexport default function f() { return 'rollup default' }`;
    });

    runCLI(`build ${esbuildLib}`);
    runCLI(`build ${viteLib}`);
    runCLI(`build ${rollupLib} --generateExportsField`);

    const pmc = getPackageManagerCommand();
    let output: string;

    // Make sure outputs in commonjs project
    createFile(
      'test-cjs/package.json',
      JSON.stringify(
        {
          name: 'test-cjs',
          private: true,
          type: 'commonjs',
          dependencies: {
            [`@proj/${esbuildLib}`]: `file:../dist/libs/${esbuildLib}`,
            [`@proj/${viteLib}`]: `file:../dist/libs/${viteLib}`,
            [`@proj/${rollupLib}`]: `file:../dist/libs/${rollupLib}`,
          },
        },
        null,
        2
      )
    );
    createFile(
      'test-cjs/index.js',
      `
        const { ${esbuildLib} } = require('@proj/${esbuildLib}');
        const { ${viteLib} } = require('@proj/${viteLib}');
        const { default: rollupDefault, ${rollupLib} } = require('@proj/${rollupLib}');
        console.log(${esbuildLib}());
        console.log(${viteLib}());
        console.log(${rollupLib}());
        console.log(rollupDefault());
      `
    );
    runCommand(pmc.install, {
      cwd: join(tmpProjPath(), 'test-cjs'),
    });
    output = runCommand('node index.js', {
      cwd: join(tmpProjPath(), 'test-cjs'),
    });
    expect(output).toContain(esbuildLib);
    expect(output).toContain(viteLib);
    expect(output).toContain(rollupLib);
    expect(output).toContain('rollup default');

    // Make sure outputs in esm project
    createFile(
      'test-esm/package.json',
      JSON.stringify(
        {
          name: 'test-esm',
          private: true,
          type: 'module',
          dependencies: {
            [`@proj/${esbuildLib}`]: `file:../dist/libs/${esbuildLib}`,
            [`@proj/${viteLib}`]: `file:../dist/libs/${viteLib}`,
            [`@proj/${rollupLib}`]: `file:../dist/libs/${rollupLib}`,
          },
        },
        null,
        2
      )
    );
    createFile(
      'test-esm/index.js',
      `
        import { ${esbuildLib} } from '@proj/${esbuildLib}';
        import { ${viteLib} } from '@proj/${viteLib}';
        import rollupDefault, { ${rollupLib} } from '@proj/${rollupLib}';
        console.log(${esbuildLib}());
        console.log(${viteLib}());
        console.log(${rollupLib}());
        console.log(rollupDefault());
      `
    );
    runCommand(pmc.install, {
      cwd: join(tmpProjPath(), 'test-esm'),
    });
    output = runCommand('node index.js', {
      cwd: join(tmpProjPath(), 'test-esm'),
    });
    expect(output).toContain(esbuildLib);
    expect(output).toContain(viteLib);
    expect(output).toContain(rollupLib);
    expect(output).toContain('rollup default');
  }, 500_000);

  it('should build with tsc, swc and be used in CJS/ESM projects', async () => {
    const tscLib = uniq('tsclib');
    const swcLib = uniq('swclib');
    const tscEsmLib = uniq('tscesmlib');
    const swcEsmLib = uniq('swcesmlib');

    runCLI(`generate @nx/js:lib libs/${tscLib} --bundler=tsc --no-interactive`);
    runCLI(
      `generate @nx/js:lib libs/${swcLib}  --bundler=swc --no-interactive`
    );
    runCLI(
      `generate @nx/js:lib libs/${tscEsmLib} --bundler=tsc --no-interactive`
    );
    runCLI(
      `generate @nx/js:lib libs/${swcEsmLib} --bundler=swc --no-interactive`
    );

    // Change module format to ESM
    updateJson(`libs/${tscEsmLib}/tsconfig.json`, (json) => {
      json.compilerOptions.module = 'esnext';
      return json;
    });
    updateJson(`libs/${tscEsmLib}/package.json`, (json) => {
      // check one lib without type, the build output should be set with type module
      delete json.type;
      return json;
    });
    updateJson(`libs/${swcEsmLib}/.swcrc`, (json) => {
      json.module.type = 'es6';
      return json;
    });
    updateJson(`libs/${swcEsmLib}/package.json`, (json) => {
      // check one lib with the type set, the build output should be set with type module
      json.type = 'module';
      return json;
    });
    // Node ESM requires file extensions in imports so must add them before building
    updateFile(
      `libs/${tscEsmLib}/src/index.ts`,
      `export * from './lib/${tscEsmLib}.js';`
    );
    updateFile(
      `libs/${swcEsmLib}/src/index.ts`,
      `export * from './lib/${swcEsmLib}.js';`
    );
    // We also need to update the eslint config file extensions to be explicitly commonjs
    // TODO: re-evaluate this once we support ESM eslint configs
    renameFile(
      `libs/${tscEsmLib}/eslint.config.js`,
      `libs/${tscEsmLib}/eslint.config.cjs`
    );
    renameFile(
      `libs/${swcEsmLib}/eslint.config.js`,
      `libs/${swcEsmLib}/eslint.config.cjs`
    );

    // Add additional entry points for `exports` field
    updateJson(join('libs', tscLib, 'project.json'), (json) => {
      json.targets.build.options.additionalEntryPoints = [
        `libs/${tscLib}/src/foo/*.ts`,
      ];
      return json;
    });
    updateFile(`libs/${tscLib}/src/foo/bar.ts`, `export const bar = 'bar';`);
    updateFile(`libs/${tscLib}/src/foo/faz.ts`, `export const faz = 'faz';`);
    updateJson(join('libs', swcLib, 'project.json'), (json) => {
      json.targets.build.options.additionalEntryPoints = [
        `libs/${swcLib}/src/foo/*.ts`,
      ];
      return json;
    });
    updateFile(`libs/${swcLib}/src/foo/bar.ts`, `export const bar = 'bar';`);
    updateFile(`libs/${swcLib}/src/foo/faz.ts`, `export const faz = 'faz';`);

    runCLI(`build ${tscLib} --generateExportsField`);
    runCLI(`build ${swcLib} --generateExportsField`);
    runCLI(`build ${tscEsmLib} --generateExportsField`);
    runCLI(`build ${swcEsmLib} --generateExportsField`);

    expect(readJson(`dist/libs/${tscLib}/package.json`).exports).toEqual({
      './package.json': './package.json',
      '.': {
        default: './src/index.js',
        types: './src/index.d.ts',
      },
      './foo/bar': './src/foo/bar.js',
      './foo/faz': './src/foo/faz.js',
    });

    expect(readJson(`dist/libs/${swcLib}/package.json`).exports).toEqual({
      './package.json': './package.json',
      '.': {
        default: './src/index.js',
        types: './src/index.d.ts',
      },
      './foo/bar': './src/foo/bar.js',
      './foo/faz': './src/foo/faz.js',
    });

    const pmc = getPackageManagerCommand();
    let output: string;

    // Make sure CJS output is correct
    createFile(
      'test-cjs/package.json',
      JSON.stringify(
        {
          name: 'test-cjs',
          private: true,
          type: 'commonjs',
          dependencies: {
            [`@proj/${tscLib}`]: `file:../dist/libs/${tscLib}`,
            [`@proj/${swcLib}`]: `file:../dist/libs/${swcLib}`,
          },
        },
        null,
        2
      )
    );
    createFile(
      'test-cjs/index.js',
      `
        const { ${tscLib} } = require('@proj/${tscLib}');
        const { ${swcLib} } = require('@proj/${swcLib}');
        // additional entry-points
        const { bar } = require('@proj/${tscLib}/foo/bar');
        const { faz } = require('@proj/${swcLib}/foo/faz');
        console.log(${tscLib}());
        console.log(${swcLib}());
        console.log(bar);
        console.log(faz);
      `
    );
    runCommand(pmc.install, {
      cwd: join(tmpProjPath(), 'test-cjs'),
    });
    output = runCommand('node index.js', {
      cwd: join(tmpProjPath(), 'test-cjs'),
    });
    expect(output).toContain(tscLib);
    expect(output).toContain(swcLib);
    expect(output).toContain('bar');
    expect(output).toContain('faz');

    // Make sure ESM output is correct
    createFile(
      'test-esm/package.json',
      JSON.stringify(
        {
          name: 'test-esm',
          private: true,
          type: 'module',
          dependencies: {
            [`@proj/${tscEsmLib}`]: `file:../dist/libs/${tscEsmLib}`,
            [`@proj/${swcEsmLib}`]: `file:../dist/libs/${swcEsmLib}`,
          },
        },
        null,
        2
      )
    );
    createFile(
      'test-esm/index.js',
      `
        import { ${tscEsmLib} } from '@proj/${tscEsmLib}';
        import { ${swcEsmLib} } from '@proj/${swcEsmLib}';
        console.log(${tscEsmLib}());
        console.log(${swcEsmLib}());
      `
    );
    runCommand(pmc.install, {
      cwd: join(tmpProjPath(), 'test-esm'),
    });
    output = runCommand('node index.js', {
      cwd: join(tmpProjPath(), 'test-esm'),
    });
    expect(output).toContain(tscEsmLib);
    expect(output).toContain(swcEsmLib);
  }, 500_000);
});
