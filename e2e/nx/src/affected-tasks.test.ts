import {
  cleanupProject,
  getStrippedEnvironmentVariables,
  newProject,
  runCLI,
  runCLIAsync,
  uniq,
  updateFile,
} from '@nx/e2e-utils';

// NX_LEGACY_AFFECTED=false opts into selecting tasks rather than whole
// projects. affected-graph.test.ts covers the default.
const byTask = { env: { NX_LEGACY_AFFECTED: 'false' } };

describe('Nx Affected with task selection', () => {
  let proj: string;

  beforeAll(
    () =>
      (proj = newProject({
        keepBackup: true,
        packages: [
          '@nx/eslint',
          '@nx/jest',
          '@nx/js',
          '@nx/playwright',
          '@nx/vite',
          '@nx/vitest',
          '@nx/web',
          '@nx/webpack',
        ],
      }))
  );
  afterAll(() => cleanupProject());

  describe('affected:*', () => {
    let myapp: string;
    let myapp2: string;
    let mylib: string;
    let mylib2: string;
    let mypublishablelib: string;

    beforeAll(() => {
      process.env.CI = 'true';
      myapp = uniq('myapp');
      myapp2 = uniq('myapp2');
      mylib = uniq('mylib');
      mylib2 = uniq('mylib2');
      mypublishablelib = uniq('mypublishablelib');
      runCLI(`generate @nx/web:app apps/${myapp} --unitTestRunner=vitest`);
      runCLI(`generate @nx/web:app apps/${myapp2} --unitTestRunner=vitest`);
      runCLI(`generate @nx/js:lib libs/${mylib}`);
      runCLI(`generate @nx/js:lib libs/${mylib2}`);
      runCLI(
        `generate @nx/js:lib libs/${mypublishablelib} --publishable --importPath=@${proj}/${mypublishablelib} --tags=ui`
      );

      updateFile(
        `apps/${myapp}/src/app/app.element.spec.ts`,
        `
          import * as x from '@${proj}/${mylib}';
          describe('sample test', () => {
            it('should test', () => {
              expect(1).toEqual(1);
            });
          });
        `
      );
      updateFile(
        `libs/${mypublishablelib}/src/lib/${mypublishablelib}.spec.ts`,
        `
          import * as x from '@${proj}/${mylib}';
          describe('sample test', () => {
            it('should test', () => {
              expect(1).toEqual(1);
            });
          });
        `
      );
      updateFile(
        `libs/${mylib}/src/lib/${mylib}.spec.ts`,
        `
          describe('sample test', () => {
            it('should test', () => {
              expect(1).toEqual(1);
            });
          });
        `
      );
    }, 1000000);

    it('selects every dependent test for a source change, as project selection does', () => {
      const affected = runCLI(
        `show projects --affected -t test --files="libs/${mylib}/src/index.ts"`,
        byTask
      );
      expect(affected).toContain(mylib);
      expect(affected).toContain(myapp);
      expect(affected).toContain(mypublishablelib);
      expect(affected).not.toContain(myapp2);
      expect(affected).not.toContain(mylib2);
    });

    it('selects only the test that reads a changed spec file', () => {
      const spec = `libs/${mylib}/src/lib/${mylib}.spec.ts`;

      // Project selection runs every dependent's test...
      const byProject = runCLI(
        `show projects --affected -t test --files="${spec}"`
      );
      expect(byProject).toContain(myapp);
      expect(byProject).toContain(mypublishablelib);

      // ...but a spec file is not in their `^production` inputs.
      const selected = runCLI(
        `show projects --affected -t test --files="${spec}"`,
        byTask
      );
      expect(selected).toContain(mylib);
      expect(selected).not.toContain(myapp);
      expect(selected).not.toContain(mypublishablelib);

      // The run agrees with the listing.
      const run = runCLI(`affected -t test --files="${spec}"`, byTask);
      expect(run).toContain(`Running target test for project ${mylib}`);
      expect(run).toContain(
        `Successfully ran target test for project ${mylib}`
      );
    }, 1000000);

    // Two targets, because with one each selected project owns one task and
    // the graph and the run could not differ. A spec change selects the
    // project's test and not its build, whose inputs are `production`.
    it('--graph shows the tasks the run executes, not every task of the selected projects', async () => {
      const spec = `libs/${mypublishablelib}/src/lib/${mypublishablelib}.spec.ts`;
      // runCLIAsync replaces the environment rather than merging into it.
      const graphOf = async (env: Record<string, string> = {}) =>
        JSON.parse(
          (
            await runCLIAsync(
              `affected -t build,test --files="${spec}" --graph stdout`,
              {
                silent: true,
                env: { ...getStrippedEnvironmentVariables(), ...env },
              }
            )
          ).stdout.trim()
        ).tasks.tasks;

      const byProject = await graphOf();
      expect(byProject[`${mypublishablelib}:build`]).toBeDefined();
      expect(byProject[`${mypublishablelib}:test`]).toBeDefined();

      const selected = await graphOf(byTask.env);
      expect(selected[`${mypublishablelib}:test`]).toBeDefined();
      expect(selected[`${mypublishablelib}:build`]).toBeUndefined();
    });
  });

  // An e2e suite continuously depends on a served app, which reads a library's
  // build. The only path from the library to the suite crosses the continuous
  // edge, and the project graph records neither dependsOn edge.
  describe('continuous dependencies', () => {
    let lib: string;
    let web: string;
    let webE2e: string;

    beforeAll(() => {
      lib = uniq('shared-ui');
      web = uniq('web');
      webE2e = uniq('web-e2e');
      const readsDependencies = [
        '{projectRoot}/**/*',
        { dependentTasksOutputFiles: '**/*', transitive: true },
      ];

      updateFile(`libs/${lib}/src/index.ts`, `export const x = 1;\n`);
      updateFile(
        `libs/${lib}/project.json`,
        JSON.stringify({
          name: lib,
          root: `libs/${lib}`,
          targets: {
            build: {
              command: 'echo build',
              outputs: [`{workspaceRoot}/dist/libs/${lib}`],
              inputs: ['{projectRoot}/**/*'],
            },
          },
        })
      );

      updateFile(`apps/${web}/src/main.ts`, `export {};\n`);
      updateFile(
        `apps/${web}/project.json`,
        JSON.stringify({
          name: web,
          root: `apps/${web}`,
          targets: {
            serve: {
              command: 'echo serve',
              continuous: true,
              dependsOn: [{ projects: [lib], target: 'build' }],
              inputs: readsDependencies,
            },
          },
        })
      );

      updateFile(`apps/${webE2e}/src/app.spec.ts`, `export {};\n`);
      updateFile(
        `apps/${webE2e}/project.json`,
        JSON.stringify({
          name: webE2e,
          root: `apps/${webE2e}`,
          targets: {
            e2e: {
              command: 'echo e2e',
              dependsOn: [{ projects: [web], target: 'serve' }],
              inputs: readsDependencies,
            },
          },
        })
      );
    });

    it('selects the suite when the library it exercises changes', () => {
      const changed = `libs/${lib}/src/index.ts`;

      expect(
        runCLI(`show projects --affected -t e2e --files="${changed}"`, byTask)
      ).toContain(webE2e);

      // Project selection has no edge to follow from the library to the suite.
      expect(
        runCLI(`show projects --affected -t e2e --files="${changed}"`)
      ).not.toContain(webE2e);
    });
  });
});
