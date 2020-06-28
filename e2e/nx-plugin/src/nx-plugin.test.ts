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
  workspaceConfigName,
} from '@nrwl/e2e/utils';

forEachCli((currentCLIName) => {
  const linter = currentCLIName === 'angular' ? 'tslint' : 'eslint';

  describe('Nx Plugin', () => {
    it('should be able to generate a Nx Plugin ', async (done) => {
      ensureProject();
      const plugin = uniq('plugin');

      runCLI(
        `generate @nrwl/nx-plugin:plugin ${plugin} --linter=${linter} --importPath=@proj/${plugin}`
      );
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
        `dist/libs/${plugin}/src/builders/build/builder.js`,
        `dist/libs/${plugin}/src/builders/build/schema.d.ts`,
        `dist/libs/${plugin}/src/builders/build/schema.json`
      );
      const nxJson = readJson('nx.json');
      expect(nxJson).toMatchObject({
        projects: expect.objectContaining({
          [plugin]: {
            tags: [],
          },
          [`${plugin}-e2e`]: {
            tags: [],
            implicitDependencies: [`${plugin}`],
          },
        }),
      });
      done();
    }, 45000);

    // the test invoke ensureNxProject, which points to @nrwl/workspace collection
    // which walks up the directory to find it in the next repo itself, so it
    // doesn't use the collection we are building
    // we should change it to point to the right collection using relative path
    it(`should run the plugin's e2e tests`, async (done) => {
      ensureProject();
      const plugin = uniq('plugin');
      runCLI(
        `generate @nrwl/nx-plugin:plugin ${plugin} --linter=${linter} --importPath=@proj/${plugin}`
      );
      const results = await runCLIAsync(`e2e ${plugin}-e2e`);
      expect(results.stdout).toContain('Compiling TypeScript files');
      expectTestsPass(results);

      done();
    }, 150000);

    it('should be able to generate a migration', async (done) => {
      ensureProject();
      const plugin = uniq('plugin');
      const version = '1.0.0';

      runCLI(
        `generate @nrwl/nx-plugin:plugin ${plugin} --linter=${linter} --importPath=@proj/${plugin}`
      );
      runCLI(
        `generate @nrwl/nx-plugin:migration --project=${plugin} --version=${version} --packageJsonUpdates=false`
      );

      const lintResults = runCLI(`lint ${plugin}`);
      expect(lintResults).toContain('All files pass linting.');

      expectTestsPass(await runCLIAsync(`test ${plugin}`));

      const buildResults = runCLI(`build ${plugin}`);
      expect(buildResults).toContain('Done compiling TypeScript files');
      checkFilesExist(
        `dist/libs/${plugin}/src/migrations/update-${version}/update-${version}.js`,
        `dist/libs/${plugin}/src/migrations/update-${version}/update-${version}.ts`,
        `dist/libs/${plugin}/src/migrations/update-${version}/update-${version}.spec.ts`,
        `libs/${plugin}/src/migrations/update-${version}/update-${version}.ts`,
        `libs/${plugin}/src/migrations/update-${version}/update-${version}.spec.ts`
      );
      const migrationsJson = readJson(`libs/${plugin}/migrations.json`);
      expect(migrationsJson).toMatchObject({
        schematics: expect.objectContaining({
          [`update-${version}`]: {
            version: version,
            description: `update-${version}`,
            factory: `./src/migrations/update-${version}/update-${version}`,
          },
        }),
      });
      done();
    }, 45000);

    it('should be able to generate a schematic', async (done) => {
      ensureProject();
      const plugin = uniq('plugin');
      const schematic = uniq('schematic');

      runCLI(
        `generate @nrwl/nx-plugin:plugin ${plugin} --linter=${linter} --importPath=@proj/${plugin}`
      );
      runCLI(
        `generate @nrwl/nx-plugin:schematic ${schematic} --project=${plugin}`
      );

      const lintResults = runCLI(`lint ${plugin}`);
      expect(lintResults).toContain('All files pass linting.');

      expectTestsPass(await runCLIAsync(`test ${plugin}`));

      const buildResults = runCLI(`build ${plugin}`);
      expect(buildResults).toContain('Done compiling TypeScript files');
      checkFilesExist(
        `libs/${plugin}/src/schematics/${schematic}/schema.d.ts`,
        `libs/${plugin}/src/schematics/${schematic}/schema.json`,
        `libs/${plugin}/src/schematics/${schematic}/schematic.ts`,
        `libs/${plugin}/src/schematics/${schematic}/schematic.spec.ts`,
        `dist/libs/${plugin}/src/schematics/${schematic}/schema.d.ts`,
        `dist/libs/${plugin}/src/schematics/${schematic}/schema.json`,
        `dist/libs/${plugin}/src/schematics/${schematic}/schematic.js`,
        `dist/libs/${plugin}/src/schematics/${schematic}/schematic.spec.ts`
      );
      const collectionJson = readJson(`libs/${plugin}/collection.json`);
      expect(collectionJson).toMatchObject({
        schematics: expect.objectContaining({
          [schematic]: {
            factory: `./src/schematics/${schematic}/schematic`,
            schema: `./src/schematics/${schematic}/schema.json`,
            description: `${schematic} schematic`,
          },
        }),
      });
      done();
    }, 45000);

    it('should be able to generate a builder', async (done) => {
      ensureProject();
      const plugin = uniq('plugin');
      const builder = uniq('builder');

      runCLI(
        `generate @nrwl/nx-plugin:plugin ${plugin} --linter=${linter} --importPath=@proj/${plugin}`
      );
      runCLI(`generate @nrwl/nx-plugin:builder ${builder} --project=${plugin}`);

      const lintResults = runCLI(`lint ${plugin}`);
      expect(lintResults).toContain('All files pass linting.');

      expectTestsPass(await runCLIAsync(`test ${plugin}`));

      const buildResults = runCLI(`build ${plugin}`);
      expect(buildResults).toContain('Done compiling TypeScript files');
      checkFilesExist(
        `libs/${plugin}/src/builders/${builder}/schema.d.ts`,
        `libs/${plugin}/src/builders/${builder}/schema.json`,
        `libs/${plugin}/src/builders/${builder}/builder.ts`,
        `libs/${plugin}/src/builders/${builder}/builder.spec.ts`,
        `dist/libs/${plugin}/src/builders/${builder}/schema.d.ts`,
        `dist/libs/${plugin}/src/builders/${builder}/schema.json`,
        `dist/libs/${plugin}/src/builders/${builder}/builder.js`,
        `dist/libs/${plugin}/src/builders/${builder}/builder.spec.ts`
      );
      const buildersJson = readJson(`libs/${plugin}/builders.json`);
      expect(buildersJson).toMatchObject({
        builders: expect.objectContaining({
          [builder]: {
            implementation: `./src/builders/${builder}/builder`,
            schema: `./src/builders/${builder}/schema.json`,
            description: `${builder} builder`,
          },
        }),
      });
      done();
    }, 45000);

    describe('--directory', () => {
      it('should create a plugin in the specified directory', () => {
        ensureProject();
        const plugin = uniq('plugin');
        runCLI(
          `generate @nrwl/nx-plugin:plugin ${plugin} --linter=${linter} --directory subdir --importPath=@proj/${plugin}`
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
          `generate @nrwl/nx-plugin:plugin ${plugin} --linter=${linter} --tags=e2etag,e2ePackage --importPath=@proj/${plugin}`
        );
        const nxJson = readJson('nx.json');
        expect(nxJson.projects[plugin].tags).toEqual(['e2etag', 'e2ePackage']);
      }, 45000);
    });
  });
});
