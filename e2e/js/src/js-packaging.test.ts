import {
  checkFilesExist,
  cleanupProject,
  newProject,
  runCLI,
  tmpProjPath,
  runCommand,
  createFile,
  uniq,
  getPackageManagerCommand,
} from '@nx/e2e/utils';
import { join } from 'path';
import { ensureDirSync } from 'fs-extra';

describe('bundling libs', () => {
  let scope: string;

  beforeEach(() => {
    scope = newProject();
  });

  afterEach(() => cleanupProject());

  it('should support esbuild, rollup, vite bundlers for building libs', () => {
    const esbuildLib = uniq('esbuildlib');
    const viteLib = uniq('vitelib');
    const rollupLib = uniq('rolluplib');

    runCLI(
      `generate @nx/js:lib ${esbuildLib} --bundler=esbuild --no-interactive`
    );
    runCLI(`generate @nx/js:lib ${viteLib} --bundler=vite --no-interactive`);
    runCLI(
      `generate @nx/js:lib ${rollupLib} --bundler=rollup --no-interactive`
    );

    runCLI(`build ${esbuildLib}`);
    runCLI(`build ${viteLib}`);
    runCLI(`build ${rollupLib}`);

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
        const { ${rollupLib} } = require('@proj/${rollupLib}');
        console.log(${esbuildLib}());
        console.log(${viteLib}());
        console.log(${rollupLib}());
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
        import { ${rollupLib} } from '@proj/${rollupLib}';
        console.log(${esbuildLib}());
        console.log(${viteLib}());
        console.log(${rollupLib}());
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
  }, 500_000);

  it('should support tsc and swc for building libs', () => {
    const tscLib = uniq('tsclib');
    const swcLib = uniq('swclib');

    runCLI(`generate @nx/js:lib ${tscLib} --bundler=tsc --no-interactive`);
    runCLI(`generate @nx/js:lib ${swcLib} --bundler=swc --no-interactive`);

    runCLI(`build ${tscLib}`);
    runCLI(`build ${swcLib}`);

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
        console.log(${tscLib}());
        console.log(${swcLib}());
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
  }, 500_000);
});
