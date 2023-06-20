import {
  cleanupProject,
  listFiles,
  newProject,
  readFile,
  rmDist,
  runCLI,
  uniq,
  updateFile,
  updateJson,
  updateProjectConfig,
} from '@nx/e2e/utils';

describe('cache', () => {
  beforeEach(() => newProject());

  afterEach(() => cleanupProject());

  it('should cache command execution', async () => {
    const myapp1 = uniq('myapp1');
    const myapp2 = uniq('myapp2');
    runCLI(`generate @nx/web:app ${myapp1}`);
    runCLI(`generate @nx/web:app ${myapp2}`);

    // run build with caching
    // --------------------------------------------
    const buildAppsCommand = `run-many --target build --projects ${[
      myapp1,
      myapp2,
    ].join()}`;
    const outputThatPutsDataIntoCache = runCLI(buildAppsCommand);
    const filesApp1 = listFiles(`dist/apps/${myapp1}`);
    const filesApp2 = listFiles(`dist/apps/${myapp2}`);
    // now the data is in cache
    expect(outputThatPutsDataIntoCache).not.toContain(
      'read the output from the cache'
    );

    rmDist();

    const outputWithBothBuildTasksCached = runCLI(buildAppsCommand);
    expect(outputWithBothBuildTasksCached).toContain(
      'read the output from the cache'
    );
    expectCached(outputWithBothBuildTasksCached, [myapp1, myapp2]);
    expect(listFiles(`dist/apps/${myapp1}`)).toEqual(filesApp1);
    expect(listFiles(`dist/apps/${myapp2}`)).toEqual(filesApp2);

    // run with skipping cache
    const outputWithBothBuildTasksCachedButSkipped = runCLI(
      buildAppsCommand + ' --skip-nx-cache'
    );
    expect(outputWithBothBuildTasksCachedButSkipped).not.toContain(
      `read the output from the cache`
    );

    // touch myapp1
    // --------------------------------------------
    updateFile(`apps/${myapp1}/src/main.ts`, (c) => {
      return `${c}\n//some comment`;
    });
    const outputWithBuildApp2Cached = runCLI(buildAppsCommand);
    expect(outputWithBuildApp2Cached).toContain(
      'read the output from the cache'
    );

    if (process.platform != 'linux') {
      // TODO(vsavkin): This should be always be matched output once you fix output watching on linux
      expectMatchedOutput(outputWithBuildApp2Cached, [myapp2]);
    } else {
      expectCached(outputWithBuildApp2Cached, [myapp2]);
    }

    // touch package.json
    // --------------------------------------------
    updateFile(`nx.json`, (c) => {
      const r = JSON.parse(c);
      r.affected = { defaultBase: 'different' };
      return JSON.stringify(r);
    });
    const outputWithNoBuildCached = runCLI(buildAppsCommand);
    expect(outputWithNoBuildCached).not.toContain(
      'read the output from the cache'
    );

    // build individual project with caching
    const individualBuildWithCache = runCLI(`build ${myapp1}`);
    expect(individualBuildWithCache).toContain('local cache');

    // skip caching when building individual projects
    const individualBuildWithSkippedCache = runCLI(
      `build ${myapp1} --skip-nx-cache`
    );
    expect(individualBuildWithSkippedCache).not.toContain('local cache');

    // run lint with caching
    // --------------------------------------------
    let lintAppsCommand = `run-many --target lint --projects ${[
      myapp1,
      myapp2,
      `${myapp1}-e2e`,
      `${myapp2}-e2e`,
    ].join()}`;
    const outputWithNoLintCached = runCLI(lintAppsCommand);
    expect(outputWithNoLintCached).not.toContain(
      'read the output from the cache'
    );

    const outputWithBothLintTasksCached = runCLI(lintAppsCommand);
    expect(outputWithBothLintTasksCached).toContain(
      'read the output from the cache'
    );
    expectMatchedOutput(outputWithBothLintTasksCached, [
      myapp1,
      myapp2,
      `${myapp1}-e2e`,
      `${myapp2}-e2e`,
    ]);

    // run without caching
    // --------------------------------------------

    // disable caching
    // --------------------------------------------
    const originalNxJson = readFile('nx.json');
    updateFile('nx.json', (c) => {
      const nxJson = JSON.parse(c);
      nxJson.tasksRunnerOptions = {
        default: {
          options: {
            cacheableOperations: [],
          },
        },
      };
      return JSON.stringify(nxJson, null, 2);
    });

    const outputWithoutCachingEnabled1 = runCLI(buildAppsCommand);

    expect(outputWithoutCachingEnabled1).not.toContain(
      'read the output from the cache'
    );

    const outputWithoutCachingEnabled2 = runCLI(buildAppsCommand);
    expect(outputWithoutCachingEnabled2).not.toContain(
      'read the output from the cache'
    );

    // re-enable caching after test
    // --------------------------------------------
    updateFile('nx.json', (c) => originalNxJson);
  }, 120000);

  it('should support using globs as outputs', async () => {
    const mylib = uniq('mylib');
    runCLI(`generate @nx/js:library ${mylib}`);
    updateProjectConfig(mylib, (c) => {
      c.targets.build = {
        executor: 'nx:run-commands',
        outputs: ['{workspaceRoot}/dist/*.txt'],
        options: {
          commands: [
            'rm -rf dist',
            'mkdir dist',
            'echo a > dist/a.txt',
            'echo b > dist/b.txt',
            'echo c > dist/c.txt',
            'echo d > dist/d.txt',
            'echo e > dist/e.txt',
            'echo f > dist/f.txt',
          ],
          parallel: false,
        },
      };
      return c;
    });

    // Run without cache
    const runWithoutCache = runCLI(`build ${mylib}`);
    expect(runWithoutCache).not.toContain('read the output from the cache');

    // Rerun without touching anything
    const rerunWithUntouchedOutputs = runCLI(`build ${mylib}`);
    expect(rerunWithUntouchedOutputs).toContain('local cache');
    const outputsWithUntouchedOutputs = listFiles('dist');
    expect(outputsWithUntouchedOutputs).toContain('a.txt');
    expect(outputsWithUntouchedOutputs).toContain('b.txt');
    expect(outputsWithUntouchedOutputs).toContain('c.txt');
    expect(outputsWithUntouchedOutputs).toContain('d.txt');
    expect(outputsWithUntouchedOutputs).toContain('e.txt');
    expect(outputsWithUntouchedOutputs).toContain('f.txt');

    // Create a file in the dist that does not match output glob
    updateFile('dist/c.ts', '');

    // Rerun
    const rerunWithNewUnrelatedFile = runCLI(`build ${mylib}`);
    expect(rerunWithNewUnrelatedFile).toContain('local cache');
    const outputsAfterAddingUntouchedFileAndRerunning = listFiles('dist');
    expect(outputsAfterAddingUntouchedFileAndRerunning).toContain('a.txt');
    expect(outputsAfterAddingUntouchedFileAndRerunning).toContain('b.txt');
    expect(outputsAfterAddingUntouchedFileAndRerunning).toContain('c.txt');
    expect(outputsAfterAddingUntouchedFileAndRerunning).toContain('d.txt');
    expect(outputsAfterAddingUntouchedFileAndRerunning).toContain('e.txt');
    expect(outputsAfterAddingUntouchedFileAndRerunning).toContain('f.txt');
    expect(outputsAfterAddingUntouchedFileAndRerunning).toContain('c.ts');

    // Clear Dist
    rmDist();

    // Rerun
    const rerunWithoutOutputs = runCLI(`build ${mylib}`);
    expect(rerunWithoutOutputs).toContain('read the output from the cache');
    const outputsWithoutOutputs = listFiles('dist');
    expect(outputsWithoutOutputs).toContain('a.txt');
    expect(outputsWithoutOutputs).toContain('b.txt');
    expect(outputsWithoutOutputs).toContain('c.txt');
    expect(outputsWithoutOutputs).toContain('d.txt');
    expect(outputsWithoutOutputs).toContain('e.txt');
    expect(outputsWithoutOutputs).toContain('f.txt');
    expect(outputsWithoutOutputs).not.toContain('c.ts');
  });

  it('should use consider filesets when hashing', async () => {
    const parent = uniq('parent');
    const child1 = uniq('child1');
    const child2 = uniq('child2');
    runCLI(`generate @nx/js:lib ${parent}`);
    runCLI(`generate @nx/js:lib ${child1}`);
    runCLI(`generate @nx/js:lib ${child2}`);
    updateJson(`nx.json`, (c) => {
      c.namedInputs = {
        default: ['{projectRoot}/**/*'],
        prod: ['!{projectRoot}/**/*.spec.ts'],
      };
      c.targetDefaults = {
        test: {
          inputs: ['default', '^prod'],
        },
      };
      return c;
    });

    updateJson(`libs/${parent}/project.json`, (c) => {
      c.implicitDependencies = [child1, child2];
      return c;
    });

    updateJson(`libs/${child1}/project.json`, (c) => {
      c.namedInputs = { prod: ['{projectRoot}/**/*.ts'] };
      return c;
    });

    const firstRun = runCLI(`test ${parent}`);
    expect(firstRun).not.toContain('read the output from the cache');

    // -----------------------------------------
    // change child2 spec
    updateFile(`libs/${child2}/src/lib/${child2}.spec.ts`, (c) => {
      return c + '\n// some change';
    });
    const child2RunSpecChange = runCLI(`test ${child2}`);
    expect(child2RunSpecChange).not.toContain('read the output from the cache');

    const parentRunSpecChange = runCLI(`test ${parent}`);
    expect(parentRunSpecChange).toContain('read the output from the cache');

    // -----------------------------------------
    // change child2 prod
    updateFile(`libs/${child2}/src/lib/${child2}.ts`, (c) => {
      return c + '\n// some change';
    });
    const child2RunProdChange = runCLI(`test ${child2}`);
    expect(child2RunProdChange).not.toContain('read the output from the cache');

    const parentRunProdChange = runCLI(`test ${parent}`);
    expect(parentRunProdChange).not.toContain('read the output from the cache');

    // -----------------------------------------
    // change child1 spec
    updateFile(`libs/${child1}/src/lib/${child1}.spec.ts`, (c) => {
      return c + '\n// some change';
    });

    // this is a miss cause child1 redefined "prod" to include all files
    const parentRunSpecChangeChild1 = runCLI(`test ${parent}`);
    expect(parentRunSpecChangeChild1).not.toContain(
      'read the output from the cache'
    );
  }, 120000);

  it('should support ENV as an input', () => {
    const lib = uniq('lib');
    runCLI(`generate @nx/js:lib ${lib}`);
    updateJson(`nx.json`, (c) => {
      c.tasksRunnerOptions.default.options.cacheableOperations.push('echo');
      c.targetDefaults = {
        echo: {
          inputs: [
            {
              env: 'NAME',
            },
          ],
        },
      };

      return c;
    });

    updateJson(`libs/${lib}/project.json`, (c) => {
      c.targets = {
        echo: {
          command: 'echo $NAME',
        },
      };
      return c;
    });

    const firstRun = runCLI(`echo ${lib}`, {
      env: { NAME: 'e2e' },
    });
    expect(firstRun).not.toContain('read the output from the cache');

    const secondRun = runCLI(`echo ${lib}`, {
      env: { NAME: 'e2e' },
    });
    expect(secondRun).toContain('read the output from the cache');

    const thirdRun = runCLI(`echo ${lib}`, {
      env: { NAME: 'change' },
    });
    expect(thirdRun).not.toContain('read the output from the cache');

    const fourthRun = runCLI(`echo ${lib}`, {
      env: { NAME: 'change' },
    });
    expect(fourthRun).toContain('read the output from the cache');
  }, 120000);

  function expectCached(
    actualOutput: string,
    expectedCachedProjects: string[]
  ) {
    expectProjectMatchTaskCacheStatus(actualOutput, expectedCachedProjects);
  }

  function expectMatchedOutput(
    actualOutput: string,
    expectedMatchedOutputProjects: string[]
  ) {
    expectProjectMatchTaskCacheStatus(
      actualOutput,
      expectedMatchedOutputProjects,
      'existing outputs match the cache'
    );
  }

  function expectProjectMatchTaskCacheStatus(
    actualOutput: string,
    expectedProjects: string[],
    cacheStatus: string = 'local cache'
  ) {
    const matchingProjects = [];
    const lines = actualOutput.split('\n');
    lines.forEach((s) => {
      if (s.trimStart().startsWith(`> nx run`)) {
        const projectName = s
          .trimStart()
          .split(`> nx run `)[1]
          .split(':')[0]
          .trim();
        if (s.indexOf(cacheStatus) > -1) {
          matchingProjects.push(projectName);
        }
      }
    });

    matchingProjects.sort((a, b) => a.localeCompare(b));
    expectedProjects.sort((a, b) => a.localeCompare(b));
    expect(matchingProjects).toEqual(expectedProjects);
  }
});
