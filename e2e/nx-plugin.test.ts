import {
  forEachCli,
  ensureProject,
  uniq,
  runCLI,
  updateFile,
  expectTestsPass,
  runCLIAsync,
  checkFilesExist,
  readJson,
  workspaceConfigName
} from './utils';

forEachCli(currentCLIName => {
  const linter = currentCLIName === 'angular' ? 'tslint' : 'eslint';

  describe('Nx Plugin', () => {
    it('should be able to generate a Nx Plugin ', async done => {
      ensureProject();
      const plugin = uniq('plugin');

      runCLI(`generate @nrwl/nx-plugin:plugin ${plugin} --linter=${linter}`);
      const lintResults = runCLI(`lint ${plugin}`);
      expect(lintResults).toContain('All files pass linting.');

      expectTestsPass(await runCLIAsync(`test ${plugin}`));

      const buildResults = runCLI(`build ${plugin}`);
      expect(buildResults).toContain('Done compiling TypeScript files');
      checkFilesExist(
        `dist/libs/${plugin}/package.json`,
        `dist/libs/${plugin}/collection.json`,
        `dist/libs/${plugin}/builders.json`,
        `dist/libs/${plugin}/src/index.js`,
        `dist/libs/${plugin}/src/schematics/${plugin}/schema.json`,
        `dist/libs/${plugin}/src/schematics/${plugin}/schema.d.ts`,
        `dist/libs/${plugin}/src/schematics/${plugin}/schematic.js`,
        `dist/libs/${plugin}/src/schematics/${plugin}/files/src/index.ts.template`,
        `dist/libs/${plugin}/src/builders/${plugin}/builder.js`,
        `dist/libs/${plugin}/src/builders/${plugin}/schema.d.ts`,
        `dist/libs/${plugin}/src/builders/${plugin}/schema.json`
      );
      const nxJson = readJson('nx.json');
      expect(nxJson).toMatchObject({
        projects: expect.objectContaining({
          [plugin]: {
            tags: []
          },
          [`${plugin}-e2e`]: {
            tags: [],
            implicitDependencies: [`${plugin}`]
          }
        })
      });
      done();
    }, 45000);

    it(`should run the plugin's e2e tests`, async done => {
      ensureProject();
      const plugin = uniq('plugin');
      runCLI(`generate @nrwl/nx-plugin:plugin ${plugin} --linter=${linter}`);
      const results = await runCLIAsync(`e2e ${plugin}-e2e`);
      expect(results.stdout).toContain('Compiling TypeScript files');
      expectTestsPass(results);

      done();
    }, 150000);

    describe('--directory', () => {
      it('should create a plugin in the specified directory', () => {
        ensureProject();
        const plugin = uniq('plugin');
        runCLI(
          `generate @nrwl/nx-plugin:plugin ${plugin} --linter=${linter} --directory subdir`
        );
        checkFilesExist(`libs/subdir/${plugin}/package.json`);
        const workspace = readJson(workspaceConfigName());
        expect(workspace.projects[`subdir-${plugin}`]).toBeTruthy();
        expect(workspace.projects[`subdir-${plugin}`].root).toBe(
          `libs/subdir/${plugin}`
        );
        expect(workspace.projects[`subdir-${plugin}-e2e`]).toBeTruthy();
      }, 45000);
    });
    describe('--tags', () => {
      it('should add tags to nx.json', async () => {
        ensureProject();
        const plugin = uniq('plugin');
        runCLI(
          `generate @nrwl/nx-plugin:plugin ${plugin} --linter=${linter} --tags=e2etag,e2ePackage`
        );
        const nxJson = readJson('nx.json');
        expect(nxJson.projects[plugin].tags).toEqual(['e2etag', 'e2ePackage']);
      }, 45000);
    });
  });
});
