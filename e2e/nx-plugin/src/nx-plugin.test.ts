import {
  checkFilesExist,
  expectTestsPass,
  isNotWindows,
  killPorts,
  newProject,
  readJson,
  runCLI,
  runCLIAsync,
  uniq,
  workspaceConfigName,
} from '@nrwl/e2e/utils';

describe('Nx Plugin', () => {
  beforeEach(() => newProject());

  it('should be able to generate a Nx Plugin ', async () => {
    const plugin = uniq('plugin');

    runCLI(`generate @nrwl/nx-plugin:plugin ${plugin} --linter=eslint`);
    const lintResults = runCLI(`lint ${plugin}`);
    expect(lintResults).toContain('All files pass linting.');

    expectTestsPass(await runCLIAsync(`test ${plugin}`));

    const buildResults = runCLI(`build ${plugin}`);
    expect(buildResults).toContain('Done compiling TypeScript files');
    checkFilesExist(
      `dist/libs/${plugin}/package.json`,
      `dist/libs/${plugin}/generators.json`,
      `dist/libs/${plugin}/executors.json`,
      `dist/libs/${plugin}/src/index.js`,
      `dist/libs/${plugin}/src/generators/${plugin}/schema.json`,
      `dist/libs/${plugin}/src/generators/${plugin}/schema.d.ts`,
      `dist/libs/${plugin}/src/generators/${plugin}/generator.js`,
      `dist/libs/${plugin}/src/generators/${plugin}/files/src/index.ts__template__`,
      `dist/libs/${plugin}/src/executors/build/executor.js`,
      `dist/libs/${plugin}/src/executors/build/schema.d.ts`,
      `dist/libs/${plugin}/src/executors/build/schema.json`
    );
    const nxJson = readJson('workspace.json');
    expect(nxJson).toMatchObject({
      projects: {
        [plugin]: {
          tags: [],
        },
        [`${plugin}-e2e`]: {
          tags: [],
          implicitDependencies: [`${plugin}`],
        },
      },
    });
  }, 90000);

  // the test invoke ensureNxProject, which points to @nrwl/workspace collection
  // which walks up the directory to find it in the next repo itself, so it
  // doesn't use the collection we are building
  // we should change it to point to the right collection using relative path
  it(`should run the plugin's e2e tests`, async () => {
    const plugin = uniq('plugin-name');
    runCLI(`generate @nrwl/nx-plugin:plugin ${plugin} --linter=eslint`);

    if (isNotWindows()) {
      const e2eResults = runCLI(`e2e ${plugin}-e2e`);
      expect(e2eResults).toContain('Running target "e2e" succeeded');
      expect(await killPorts()).toBeTruthy();
    }
  }, 250000);

  it('should be able to generate a migration', async () => {
    const plugin = uniq('plugin');
    const version = '1.0.0';

    runCLI(`generate @nrwl/nx-plugin:plugin ${plugin} --linter=eslint`);
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
      `libs/${plugin}/src/migrations/update-${version}/update-${version}.ts`
    );
    const migrationsJson = readJson(`libs/${plugin}/migrations.json`);
    expect(migrationsJson).toMatchObject({
      generators: expect.objectContaining({
        [`update-${version}`]: {
          version,
          description: `update-${version}`,
          cli: `nx`,
          implementation: `./src/migrations/update-${version}/update-${version}`,
        },
      }),
    });
  }, 90000);

  it('should be able to generate a generator', async () => {
    const plugin = uniq('plugin');
    const generator = uniq('generator');

    runCLI(`generate @nrwl/nx-plugin:plugin ${plugin} --linter=eslint`);
    runCLI(
      `generate @nrwl/nx-plugin:generator ${generator} --project=${plugin}`
    );

    const lintResults = runCLI(`lint ${plugin}`);
    expect(lintResults).toContain('All files pass linting.');

    expectTestsPass(await runCLIAsync(`test ${plugin}`));

    const buildResults = runCLI(`build ${plugin}`);
    expect(buildResults).toContain('Done compiling TypeScript files');
    checkFilesExist(
      `libs/${plugin}/src/generators/${generator}/schema.d.ts`,
      `libs/${plugin}/src/generators/${generator}/schema.json`,
      `libs/${plugin}/src/generators/${generator}/generator.ts`,
      `libs/${plugin}/src/generators/${generator}/generator.spec.ts`,
      `dist/libs/${plugin}/src/generators/${generator}/schema.d.ts`,
      `dist/libs/${plugin}/src/generators/${generator}/schema.json`,
      `dist/libs/${plugin}/src/generators/${generator}/generator.js`
    );
    const generatorJson = readJson(`libs/${plugin}/generators.json`);
    expect(generatorJson).toMatchObject({
      generators: expect.objectContaining({
        [generator]: {
          factory: `./src/generators/${generator}/generator`,
          schema: `./src/generators/${generator}/schema.json`,
          description: `${generator} generator`,
        },
      }),
    });
  }, 90000);

  it('should be able to generate a executor', async () => {
    const plugin = uniq('plugin');
    const executor = uniq('executor');

    runCLI(`generate @nrwl/nx-plugin:plugin ${plugin} --linter=eslint`);
    runCLI(`generate @nrwl/nx-plugin:executor ${executor} --project=${plugin}`);

    const lintResults = runCLI(`lint ${plugin}`);
    expect(lintResults).toContain('All files pass linting.');

    expectTestsPass(await runCLIAsync(`test ${plugin}`));

    const buildResults = runCLI(`build ${plugin}`);
    expect(buildResults).toContain('Done compiling TypeScript files');
    checkFilesExist(
      `libs/${plugin}/src/executors/${executor}/schema.d.ts`,
      `libs/${plugin}/src/executors/${executor}/schema.json`,
      `libs/${plugin}/src/executors/${executor}/executor.ts`,
      `libs/${plugin}/src/executors/${executor}/executor.spec.ts`,
      `dist/libs/${plugin}/src/executors/${executor}/schema.d.ts`,
      `dist/libs/${plugin}/src/executors/${executor}/schema.json`,
      `dist/libs/${plugin}/src/executors/${executor}/executor.js`
    );
    const executorsJson = readJson(`libs/${plugin}/executors.json`);
    expect(executorsJson).toMatchObject({
      executors: expect.objectContaining({
        [executor]: {
          implementation: `./src/executors/${executor}/executor`,
          schema: `./src/executors/${executor}/schema.json`,
          description: `${executor} executor`,
        },
      }),
    });
  }, 90000);

  describe('--directory', () => {
    it('should create a plugin in the specified directory', () => {
      const plugin = uniq('plugin');
      runCLI(
        `generate @nrwl/nx-plugin:plugin ${plugin} --linter=eslint --directory subdir`
      );
      checkFilesExist(`libs/subdir/${plugin}/package.json`);
      const workspace = readJson(workspaceConfigName());
      expect(workspace.projects[`subdir-${plugin}`]).toBeTruthy();
      expect(workspace.projects[`subdir-${plugin}`].root).toBe(
        `libs/subdir/${plugin}`
      );
      expect(workspace.projects[`subdir-${plugin}-e2e`]).toBeTruthy();
    }, 90000);
  });
  describe('--tags', () => {
    it('should add tags to workspace.json', async () => {
      const plugin = uniq('plugin');
      runCLI(
        `generate @nrwl/nx-plugin:plugin ${plugin} --linter=eslint --tags=e2etag,e2ePackage`
      );
      const workspaceJson = readJson('workspace.json');
      expect(workspaceJson.projects[plugin].tags).toEqual([
        'e2etag',
        'e2ePackage',
      ]);
    }, 90000);
  });
});
