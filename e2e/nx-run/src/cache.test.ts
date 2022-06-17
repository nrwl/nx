import {
  cleanupProject,
  listFiles,
  newProject,
  readFile,
  rmDist,
  runCLI,
  uniq,
  updateFile,
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

  it('should only cache specific files if build outputs is configured with specific files', async () => {
    const mylib1 = uniq('mylib1');
    runCLI(`generate @nrwl/react:lib ${mylib1} --buildable`);

    // Update outputs in workspace.json to just be a particular file
    updateProjectConfig(mylib1, (config) => {
      config.targets['build-base'] = {
        ...config.targets.build,
      };
      config.targets.build = {
        executor: '@nrwl/workspace:run-commands',
        outputs: [`dist/libs/${mylib1}/index.js`],
        options: {
          commands: [
            {
              command: `npx nx run ${mylib1}:build-base`,
            },
          ],
          parallel: false,
        },
      };
      return config;
    });

    // run build with caching
    // --------------------------------------------
    const outputThatPutsDataIntoCache = runCLI(`run ${mylib1}:build`);
    // now the data is in cache
    expect(outputThatPutsDataIntoCache).not.toContain('cache');

    rmDist();

    const outputWithBuildTasksCached = runCLI(`run ${mylib1}:build`);
    expect(outputWithBuildTasksCached).toContain('cache');
    expectCached(outputWithBuildTasksCached, [mylib1]);
    // Ensure that only the specific file in outputs was copied to cache
    expect(listFiles(`dist/libs/${mylib1}`)).toEqual([`index.js`]);
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
