import {
  cleanupProject,
  getPackageManagerCommand,
  getSelectedPackageManager,
  newProject,
  readJson,
  runCLI,
  runCommand,
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

  it('should generate libraries with different bundlers and link them successfully', () => {
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

    runCLI(
      `generate @nx/js:lib packages/${esbuildParentLib} --bundler=esbuild --linter=eslint --unitTestRunner=jest`
    );
    runCLI(
      `generate @nx/js:lib packages/${esbuildChildLib} --bundler=esbuild --linter=eslint --unitTestRunner=jest`
    );
    runCLI(
      `generate @nx/js:lib packages/${rollupParentLib} --bundler=rollup --linter=eslint --unitTestRunner=jest`
    );
    runCLI(
      `generate @nx/js:lib packages/${rollupChildLib} --bundler=rollup --linter=eslint --unitTestRunner=jest`
    );
    runCLI(
      `generate @nx/js:lib packages/${swcParentLib} --bundler=swc --linter=eslint --unitTestRunner=jest`
    );
    runCLI(
      `generate @nx/js:lib packages/${swcChildLib} --bundler=swc --linter=eslint --unitTestRunner=jest`
    );
    runCLI(
      `generate @nx/js:lib packages/${tscParentLib} --bundler=tsc --linter=eslint --unitTestRunner=jest`
    );
    runCLI(
      `generate @nx/js:lib packages/${tscChildLib} --bundler=tsc --linter=eslint --unitTestRunner=jest`
    );
    runCLI(
      `generate @nx/js:lib packages/${viteParentLib} --bundler=vite --linter=eslint --unitTestRunner=jest`
    );
    runCLI(
      `generate @nx/js:lib packages/${viteChildLib} --bundler=vite --linter=eslint --unitTestRunner=jest`
    );

    // add deps, each parent lib imports all child libs
    const addImports = (parentLib: string) => {
      updateFile(
        `packages/${parentLib}/src/index.ts`,
        (content) => `export * from '@proj/${esbuildChildLib}';
export * from '@proj/${rollupChildLib}';
export * from '@proj/${swcChildLib}';
export * from '@proj/${tscChildLib}';
export * from '@proj/${viteChildLib}';
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
          return json;
        });
      };

      addDeps(esbuildParentLib);
      addDeps(rollupParentLib);
      addDeps(swcParentLib);
      addDeps(tscParentLib);
      addDeps(viteParentLib);

      const pmc = getPackageManagerCommand({ packageManager: pm });
      runCommand(pmc.install);
    }

    // sync to ensure the TS project references are updated
    runCLI(`sync`);

    // check build
    expect(runCLI(`build ${esbuildParentLib}`)).toContain(
      `Successfully ran target build for project @proj/${esbuildParentLib} and 5 tasks it depends on`
    );
    expect(runCLI(`build ${rollupParentLib}`)).toContain(
      `Successfully ran target build for project @proj/${rollupParentLib} and 5 tasks it depends on`
    );
    expect(runCLI(`build ${swcParentLib}`)).toContain(
      `Successfully ran target build for project @proj/${swcParentLib} and 5 tasks it depends on`
    );
    expect(runCLI(`build ${tscParentLib}`)).toContain(
      `Successfully ran target build for project @proj/${tscParentLib} and 5 tasks it depends on`
    );
    expect(runCLI(`build ${viteParentLib}`)).toContain(
      `Successfully ran target build for project @proj/${viteParentLib} and 5 tasks it depends on`
    );

    // check typecheck
    expect(runCLI(`typecheck ${esbuildParentLib}`)).toContain(
      `Successfully ran target typecheck for project @proj/${esbuildParentLib} and 5 tasks it depends on`
    );
    expect(runCLI(`typecheck ${rollupParentLib}`)).toContain(
      `Successfully ran target typecheck for project @proj/${rollupParentLib} and 5 tasks it depends on`
    );
    expect(runCLI(`typecheck ${swcParentLib}`)).toContain(
      `Successfully ran target typecheck for project @proj/${swcParentLib} and 5 tasks it depends on`
    );
    expect(runCLI(`typecheck ${tscParentLib}`)).toContain(
      `Successfully ran target typecheck for project @proj/${tscParentLib} and 5 tasks it depends on`
    );
    expect(runCLI(`typecheck ${viteParentLib}`)).toContain(
      `Successfully ran target typecheck for project @proj/${viteParentLib} and 5 tasks it depends on`
    );

    // check lint
    expect(runCLI(`lint ${esbuildParentLib}`)).toContain(
      `Successfully ran target lint for project @proj/${esbuildParentLib}`
    );
    expect(runCLI(`lint ${rollupParentLib}`)).toContain(
      `Successfully ran target lint for project @proj/${rollupParentLib}`
    );
    expect(runCLI(`lint ${swcParentLib}`)).toContain(
      `Successfully ran target lint for project @proj/${swcParentLib}`
    );
    expect(runCLI(`lint ${tscParentLib}`)).toContain(
      `Successfully ran target lint for project @proj/${tscParentLib}`
    );
    expect(runCLI(`lint ${viteParentLib}`)).toContain(
      `Successfully ran target lint for project @proj/${viteParentLib}`
    );

    // check test
    expect(runCLI(`test ${esbuildParentLib}`)).toContain(
      `Successfully ran target test for project @proj/${esbuildParentLib}`
    );
    expect(runCLI(`test ${rollupParentLib}`)).toContain(
      `Successfully ran target test for project @proj/${rollupParentLib}`
    );
    expect(runCLI(`test ${swcParentLib}`)).toContain(
      `Successfully ran target test for project @proj/${swcParentLib}`
    );
    expect(runCLI(`test ${tscParentLib}`)).toContain(
      `Successfully ran target test for project @proj/${tscParentLib}`
    );
    expect(runCLI(`test ${viteParentLib}`)).toContain(
      `Successfully ran target test for project @proj/${viteParentLib}`
    );
  }, 300_000);

  it('should respect and support generating libraries with a name different than the import path', () => {
    const lib1 = uniq('lib1');

    runCLI(
      `generate @nx/js:lib packages/${lib1} --name=${lib1} --linter=eslint --unitTestRunner=jest`
    );

    const packageJson = readJson(`packages/${lib1}/package.json`);
    expect(packageJson.nx.name).toBe(lib1);

    expect(runCLI(`build ${lib1}`)).toContain(
      `Successfully ran target build for project ${lib1}`
    );
    expect(runCLI(`typecheck ${lib1}`)).toContain(
      `Successfully ran target typecheck for project ${lib1}`
    );
    expect(runCLI(`lint ${lib1}`)).toContain(
      `Successfully ran target lint for project ${lib1}`
    );
    expect(runCLI(`test ${lib1}`)).toContain(
      `Successfully ran target test for project ${lib1}`
    );
  }, 300_000);
});
