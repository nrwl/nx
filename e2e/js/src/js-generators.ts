import {
  checkFilesDoNotExist,
  checkFilesExist,
  cleanupProject,
  newProject,
  readFile,
  readJson,
  rmDist,
  runCLI,
  runCLIAsync,
  uniq,
  updateFile,
  updateJson,
} from '../../utils';

describe('js e2e', () => {
  let scope: string;

  beforeAll(() => {
    scope = newProject();
  });

  afterAll(() => cleanupProject());

  it('should create libs with npm scripts', () => {
    const npmScriptsLib = uniq('npmscriptslib');
    runCLI(
      `generate @nx/js:lib ${npmScriptsLib} --config=npm-scripts --no-interactive`
    );
    const libPackageJson = readJson(`libs/${npmScriptsLib}/package.json`);
    expect(libPackageJson.scripts.test).toBeDefined();
    expect(libPackageJson.scripts.build).toBeDefined();
    expect(runCLI(`test ${npmScriptsLib}`)).toContain('implement test');

    const tsconfig = readJson(`tsconfig.base.json`);
    expect(tsconfig.compilerOptions.paths).toEqual({
      [`@${scope}/${npmScriptsLib}`]: [`libs/${npmScriptsLib}/src/index.ts`],
    });
  }, 240_000);

  it('should create a library that can be linted and tested', async () => {
    const libName = uniq('mylib');
    const dirName = uniq('dir');

    runCLI(`generate @nx/js:lib ${libName} --directory ${dirName}`);

    checkFilesExist(
      `libs/${dirName}/${libName}/src/index.ts`,
      `libs/${dirName}/${libName}/README.md`
    );

    // Lint
    const result = runCLI(`lint ${dirName}-${libName}`);

    expect(result).toContain(`Linting "${dirName}-${libName}"...`);
    expect(result).toContain('All files pass linting');

    // Test
    const testResult = await runCLIAsync(`test ${dirName}-${libName}`);
    expect(testResult.combinedOutput).toContain(
      'Test Suites: 1 passed, 1 total'
    );
  }, 500_000);

  it('should be able to add build to non-buildable projects', () => {
    const nonBuildable = uniq('nonbuildable');

    runCLI(`generate @nx/js:lib ${nonBuildable} --bundler=none`);
    expect(() => runCLI(`build ${nonBuildable}`)).toThrow();
    checkFilesDoNotExist(`dist/libs/${nonBuildable}/src/index.js`);

    runCLI(`generate @nx/js:setup-build ${nonBuildable} --bundler=tsc`);
    runCLI(`build ${nonBuildable}`);
    checkFilesExist(`dist/libs/${nonBuildable}/src/index.js`);
  });

  it('should build buildable libraries using the task graph and handle more scenarios than current implementation', () => {
    const lib1 = uniq('lib1');
    const lib2 = uniq('lib2');
    runCLI(`generate @nx/js:lib ${lib1} --bundler=tsc --no-interactive`);
    runCLI(`generate @nx/js:lib ${lib2} --bundler=tsc --no-interactive`);

    // add dep between lib1 and lib2
    updateFile(
      `libs/${lib1}/src/index.ts`,
      `export { ${lib2} } from '@${scope}/${lib2}';`
    );

    // check current implementation
    expect(runCLI(`build ${lib1} --skip-nx-cache`)).toContain(
      'Done compiling TypeScript files'
    );
    checkFilesExist(`dist/libs/${lib1}/src/index.js`);
    checkFilesExist(`dist/libs/${lib2}/src/index.js`);

    // cleanup dist
    rmDist();

    // check task graph implementation
    expect(
      runCLI(`build ${lib1} --skip-nx-cache`, {
        env: { NX_BUILDABLE_LIBRARIES_TASK_GRAPH: 'true' },
      })
    ).toContain('Done compiling TypeScript files');
    checkFilesExist(`dist/libs/${lib1}/src/index.js`);
    checkFilesExist(`dist/libs/${lib2}/src/index.js`);

    // change build target name of lib2 and update target dependencies
    updateJson(`libs/${lib2}/project.json`, (json) => {
      json.targets['my-custom-build'] = json.targets.build;
      delete json.targets.build;
      return json;
    });
    const originalNxJson = readFile('nx.json');
    updateJson('nx.json', (json) => {
      json.targetDefaults.build = {
        ...json.targetDefaults.build,
        dependsOn: [...json.targetDefaults.build.dependsOn, '^my-custom-build'],
      };
      return json;
    });

    // cleanup dist
    rmDist();

    // check current implementation, it doesn't support a different build target name
    expect(() => runCLI(`build ${lib1} --skip-nx-cache`)).toThrow();

    // cleanup dist
    rmDist();

    // check task graph implementation
    expect(
      runCLI(`build ${lib1} --skip-nx-cache`, {
        env: { NX_BUILDABLE_LIBRARIES_TASK_GRAPH: 'true' },
      })
    ).toContain('Done compiling TypeScript files');
    checkFilesExist(`dist/libs/${lib1}/src/index.js`);
    checkFilesExist(`dist/libs/${lib2}/src/index.js`);

    // restore nx.json
    updateFile('nx.json', () => originalNxJson);
  });

  it('should generate project with name and directory as provided when --project-name-and-root-format=as-provided', async () => {
    const lib1 = uniq('lib1');
    runCLI(
      `generate @nx/js:lib ${lib1} --directory=shared --bundler=tsc --project-name-and-root-format=as-provided`
    );

    // check files are generated without the layout directory ("libs/") and
    // in the directory provided (no project name appended)
    checkFilesExist('shared/src/index.ts');
    // check project name is as provided (no prefixed directory name)
    expect(runCLI(`build ${lib1}`)).toContain(
      'Done compiling TypeScript files'
    );
    // check tests pass
    const testResult = await runCLIAsync(`test ${lib1}`);
    expect(testResult.combinedOutput).toContain(
      'Test Suites: 1 passed, 1 total'
    );
  }, 500_000);

  it('should support generating with a scoped project name when --project-name-and-root-format=as-provided', async () => {
    const scopedLib = uniq('@my-org/lib1');

    // assert scoped project names are not supported when --project-name-and-root-format=derived
    expect(() =>
      runCLI(
        `generate @nx/js:lib ${scopedLib} --bundler=tsc --project-name-and-root-format=derived`
      )
    ).toThrow();

    runCLI(
      `generate @nx/js:lib ${scopedLib} --bundler=tsc --project-name-and-root-format=as-provided`
    );

    // check files are generated without the layout directory ("libs/") and
    // using the project name as the directory when no directory is provided
    checkFilesExist(
      `${scopedLib}/src/index.ts`,
      `${scopedLib}/src/lib/${scopedLib.split('/')[1]}.ts`
    );
    // check build works
    expect(runCLI(`build ${scopedLib}`)).toContain(
      'Done compiling TypeScript files'
    );
    // check tests pass
    const testResult = await runCLIAsync(`test ${scopedLib}`);
    expect(testResult.combinedOutput).toContain(
      'Test Suites: 1 passed, 1 total'
    );
  }, 500_000);
});
