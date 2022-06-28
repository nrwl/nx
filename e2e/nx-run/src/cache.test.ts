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
} from '@nrwl/e2e/utils';

describe('cache', () => {
  beforeEach(() => newProject());

  afterAll(() => cleanupProject());

  it('should cache command execution', async () => {
    const myapp1 = uniq('myapp1');
    const myapp2 = uniq('myapp2');
    runCLI(`generate @nrwl/web:app ${myapp1}`);
    runCLI(`generate @nrwl/web:app ${myapp2}`);
    const files = `--files="apps/${myapp1}/src/main.ts,apps/${myapp2}/src/main.ts"`;

    // run build with caching
    // --------------------------------------------
    const outputThatPutsDataIntoCache = runCLI(`affected:build ${files}`);
    const filesApp1 = listFiles(`dist/apps/${myapp1}`);
    const filesApp2 = listFiles(`dist/apps/${myapp2}`);
    // now the data is in cache
    expect(outputThatPutsDataIntoCache).not.toContain(
      'read the output from the cache'
    );

    rmDist();

    const outputWithBothBuildTasksCached = runCLI(`affected:build ${files}`);
    expect(outputWithBothBuildTasksCached).toContain(
      'read the output from the cache'
    );
    expectCached(outputWithBothBuildTasksCached, [myapp1, myapp2]);
    expect(listFiles(`dist/apps/${myapp1}`)).toEqual(filesApp1);
    expect(listFiles(`dist/apps/${myapp2}`)).toEqual(filesApp2);

    // run with skipping cache
    const outputWithBothBuildTasksCachedButSkipped = runCLI(
      `affected:build ${files} --skip-nx-cache`
    );
    expect(outputWithBothBuildTasksCachedButSkipped).not.toContain(
      `read the output from the cache`
    );

    // touch myapp1
    // --------------------------------------------
    updateFile(`apps/${myapp1}/src/main.ts`, (c) => {
      return `${c}\n//some comment`;
    });
    const outputWithBuildApp2Cached = runCLI(`affected:build ${files}`);
    expect(outputWithBuildApp2Cached).toContain(
      'read the output from the cache'
    );
    expectMatchedOutput(outputWithBuildApp2Cached, [myapp2]);

    // touch package.json
    // --------------------------------------------
    updateFile(`package.json`, (c) => {
      const r = JSON.parse(c);
      r.description = 'different';
      return JSON.stringify(r);
    });
    const outputWithNoBuildCached = runCLI(`affected:build ${files}`);
    expect(outputWithNoBuildCached).not.toContain(
      'read the output from the cache'
    );

    // build individual project with caching
    const individualBuildWithCache = runCLI(`build ${myapp1}`);
    expect(individualBuildWithCache).toContain(
      'existing outputs match the cache'
    );

    // skip caching when building individual projects
    const individualBuildWithSkippedCache = runCLI(
      `build ${myapp1} --skip-nx-cache`
    );
    expect(individualBuildWithSkippedCache).not.toContain(
      'existing outputs match the cache'
    );

    // run lint with caching
    // --------------------------------------------
    const outputWithNoLintCached = runCLI(`affected:lint ${files}`);
    expect(outputWithNoLintCached).not.toContain(
      'read the output from the cache'
    );

    const outputWithBothLintTasksCached = runCLI(`affected:lint ${files}`);
    expect(outputWithBothLintTasksCached).toContain(
      'read the output from the cache'
    );
    expectCached(outputWithBothLintTasksCached, [
      myapp1,
      myapp2,
      `${myapp1}-e2e`,
      `${myapp2}-e2e`,
    ]);

    // cache task failures
    // --------------------------------------------
    // updateFile('workspace.json', (c) => {
    //   const workspaceJson = JSON.parse(c);
    //   workspaceJson.projects[myapp1].targets.lint = {
    //     executor: '@nrwl/workspace:run-commands',
    //     options: {
    //       command: 'echo hi && exit 1',
    //     },
    //   };
    //   return JSON.stringify(workspaceJson, null, 2);
    // });
    // const failingRun = runCLI(`lint ${myapp1}`, {
    //   silenceError: true,
    //   env: { ...process.env, NX_CACHE_FAILURES: 'true' },
    // });
    // expect(failingRun).not.toContain('[retrieved from cache]');
    //
    // const cachedFailingRun = runCLI(`lint ${myapp1}`, {
    //   silenceError: true,
    //   env: { ...process.env, NX_CACHE_FAILURES: 'true' },
    // });
    // expect(cachedFailingRun).toContain('[retrieved from cache]');

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

    const outputWithoutCachingEnabled1 = runCLI(`affected:build ${files}`);

    expect(outputWithoutCachingEnabled1).not.toContain(
      'read the output from the cache'
    );

    const outputWithoutCachingEnabled2 = runCLI(`affected:build ${files}`);
    expect(outputWithoutCachingEnabled2).not.toContain(
      'read the output from the cache'
    );

    // re-enable caching after test
    // --------------------------------------------
    updateFile('nx.json', (c) => originalNxJson);
  }, 120000);

  it('should use consider filesets when hashing', async () => {
    const parent = uniq('parent');
    const child1 = uniq('child1');
    const child2 = uniq('child2');
    runCLI(`generate @nrwl/js:lib ${parent}`);
    runCLI(`generate @nrwl/js:lib ${child1}`);
    runCLI(`generate @nrwl/js:lib ${child2}`);
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
