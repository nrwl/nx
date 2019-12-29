import {
  ensureProject,
  forEachCli,
  listFiles,
  rmDist,
  runCLI,
  runCommand,
  uniq,
  updateFile
} from './utils';

forEachCli(() => {
  describe('Cache', () => {
    it('should not use cache when it is not enabled', async () => {
      ensureProject();

      const myapp1 = uniq('myapp1');
      const myapp2 = uniq('myapp2');
      runCLI(`generate @nrwl/web:app ${myapp1}`);
      runCLI(`generate @nrwl/web:app ${myapp2}`);
      const files = `--files="apps/${myapp1}/src/main.ts,apps/${myapp2}/src/main.ts"`;

      // run without caching
      // --------------------------------------------
      const outputWithoutCachingEnabled1 = runCommand(
        `npm run affected:build -- ${files}`
      );
      const filesApp1 = listFiles(`dist/apps/${myapp1}`);
      const filesApp2 = listFiles(`dist/apps/${myapp2}`);

      expect(outputWithoutCachingEnabled1).not.toContain(
        'read the output from cache'
      );

      const outputWithoutCachingEnabled2 = runCommand(
        `npm run affected:build -- ${files}`
      );
      expect(outputWithoutCachingEnabled2).not.toContain(
        'read the output from cache'
      );

      // enable caching
      // --------------------------------------------
      updateFile('nx.json', c => {
        const nxJson = JSON.parse(c);
        nxJson.tasksRunnerOptions = {
          default: {
            runner: '@nrwl/workspace/src/tasks-runner/tasks-runner-v2',
            options: {
              cacheableOperations: ['build', 'lint']
            }
          }
        };
        return JSON.stringify(nxJson, null, 2);
      });

      // run build with caching
      // --------------------------------------------
      const outputThatPutsDataIntoCache = runCommand(
        `npm run affected:build -- ${files}`
      );
      // now the data is in cache
      expect(outputThatPutsDataIntoCache).not.toContain(
        'read the output from cache'
      );

      rmDist();

      const outputWithBothBuildTasksCached = runCommand(
        `npm run affected:build -- ${files}`
      );
      expect(outputWithBothBuildTasksCached).toContain(
        'read the output from cache'
      );
      expectCached(outputWithBothBuildTasksCached, [myapp1, myapp2]);
      expect(listFiles(`dist/apps/${myapp1}`)).toEqual(filesApp1);
      expect(listFiles(`dist/apps/${myapp2}`)).toEqual(filesApp2);

      // touch myapp1
      // --------------------------------------------
      updateFile(`apps/${myapp1}/src/main.ts`, c => {
        return `${c}\n//some comment`;
      });
      const outputWithBuildApp2Cached = runCommand(
        `npm run affected:build -- ${files}`
      );
      expect(outputWithBuildApp2Cached).toContain('read the output from cache');
      expectCached(outputWithBuildApp2Cached, [myapp2]);

      // touch package.json
      // --------------------------------------------
      updateFile(`package.json`, c => {
        const r = JSON.parse(c);
        r.description = 'different';
        return JSON.stringify(r);
      });
      const outputWithNoBuildCached = runCommand(
        `npm run affected:build -- ${files}`
      );
      expect(outputWithNoBuildCached).not.toContain(
        'read the output from cache'
      );

      // run lint with caching
      // --------------------------------------------
      const outputWithNoLintCached = runCommand(
        `npm run affected:lint -- ${files}`
      );
      expect(outputWithNoLintCached).not.toContain(
        'read the output from cache'
      );

      const outputWithBothLintTasksCached = runCommand(
        `npm run affected:lint -- ${files}`
      );
      expect(outputWithBothLintTasksCached).toContain(
        'read the output from cache'
      );
      expectCached(outputWithBothLintTasksCached, [
        myapp1,
        myapp2,
        `${myapp1}-e2e`,
        `${myapp2}-e2e`
      ]);
    }, 120000);
  });

  function expectCached(actual: string, expected: string[]) {
    const section = actual.split('read the output from cache')[1];
    const r = section
      .split('\n')
      .filter(l => l.trim().startsWith('-'))
      .map(l => l.split('- ')[1].trim());
    r.sort((a, b) => a.localeCompare(b));
    expected.sort((a, b) => a.localeCompare(b));
    expect(r).toEqual(expected);
  }
});
