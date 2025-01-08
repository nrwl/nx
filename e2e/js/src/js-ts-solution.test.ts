import {
  cleanupProject,
  getSelectedPackageManager,
  newProject,
  runCLI,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e/utils';

describe('JS - TS solution setup', () => {
  beforeAll(() => {
    newProject({
      packages: ['@nx/js'],
      preset: 'ts',
    });
  });

  afterAll(() => {
    cleanupProject();
  });

  it('should generate libraries with different bundlers, link them and build them successfully', () => {
    const esbuildParentLib = uniq('esbuild-parent-lib');
    const esbuildChildLib = uniq('esbuild-child-lib');
    const rollupParentLib = uniq('rollup-parent-lib');
    const rollupChildLib = uniq('rollup-child-lib');
    const swcParentLib = uniq('swc-parent-lib');
    const swcChildLib = uniq('swc-child-lib');
    const tscParentLib = uniq('tsc-parent-lib');
    const tscChildLib = uniq('tsc-child-lib');
    const viteParentLib = uniq('vite-parent-lib');
    const viteChildLib = uniq('vite-child-lib');
    const noBundlerLib = uniq('no-bundler-lib');

    runCLI(
      `generate @nx/js:lib packages/${esbuildParentLib} --bundler=esbuild`
    );
    runCLI(`generate @nx/js:lib packages/${esbuildChildLib} --bundler=esbuild`);
    runCLI(`generate @nx/js:lib packages/${rollupParentLib} --bundler=rollup`);
    runCLI(`generate @nx/js:lib packages/${rollupChildLib} --bundler=rollup`);
    runCLI(`generate @nx/js:lib packages/${swcParentLib} --bundler=swc`);
    runCLI(`generate @nx/js:lib packages/${swcChildLib} --bundler=swc`);
    runCLI(`generate @nx/js:lib packages/${tscParentLib} --bundler=tsc`);
    runCLI(`generate @nx/js:lib packages/${tscChildLib} --bundler=tsc`);
    runCLI(`generate @nx/js:lib packages/${viteParentLib} --bundler=vite`);
    runCLI(`generate @nx/js:lib packages/${viteChildLib} --bundler=vite`);
    runCLI(`generate @nx/js:lib packages/${noBundlerLib} --bundler=none`);

    // add deps, each parent lib imports all child libs
    const addImports = (parentLib: string) => {
      updateFile(
        `packages/${parentLib}/src/index.ts`,
        (content) => `export * from '@proj/${esbuildChildLib}';
export * from '@proj/${rollupChildLib}';
export * from '@proj/${swcChildLib}';
export * from '@proj/${tscChildLib}';
export * from '@proj/${viteChildLib}';
export * from '@proj/${noBundlerLib}';
${content}`
      );
    };

    addImports(esbuildParentLib);
    addImports(rollupParentLib);
    addImports(swcParentLib);
    addImports(tscParentLib);
    addImports(viteParentLib);

    const pm = getSelectedPackageManager();
    if (pm === 'pnpm') {
      // for pnpm we need to add the local packages as dependencies to each consumer package.json
      const addDeps = (parentLib: string) => {
        updateJson(`packages/${parentLib}/package.json`, (json) => {
          json.dependencies ??= {};
          json.dependencies[`@proj/${esbuildChildLib}`] = 'workspace:*';
          json.dependencies[`@proj/${rollupChildLib}`] = 'workspace:*';
          json.dependencies[`@proj/${swcChildLib}`] = 'workspace:*';
          json.dependencies[`@proj/${tscChildLib}`] = 'workspace:*';
          json.dependencies[`@proj/${viteChildLib}`] = 'workspace:*';
          json.dependencies[`@proj/${noBundlerLib}`] = 'workspace:*';
          return json;
        });
      };

      addDeps(esbuildParentLib);
      addDeps(rollupParentLib);
      addDeps(swcParentLib);
      addDeps(tscParentLib);
      addDeps(viteParentLib);
    }

    // sync to ensure the TS project references are updated
    runCLI(`sync`);

    expect(() => runCLI(`build ${esbuildParentLib}`)).not.toThrow();
    expect(() => runCLI(`build ${rollupParentLib}`)).not.toThrow();
    expect(() => runCLI(`build ${swcParentLib}`)).not.toThrow();
    expect(() => runCLI(`build ${tscParentLib}`)).not.toThrow();
    expect(() => runCLI(`build ${viteParentLib}`)).not.toThrow();
  }, 300_000);
});
