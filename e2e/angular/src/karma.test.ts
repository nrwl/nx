import {
  ensureProject,
  forEachCli,
  patchKarmaToWorkOnWSL,
  runCLI,
  runCLIAsync,
  uniq,
} from '@nrwl/e2e/utils';

forEachCli(() => {
  // TODO: This test is super flaky, investigate and re-enable.
  xdescribe('Karma', () => {
    it('should be able to generate a testable library using karma', async (done) => {
      ensureProject();

      // run an app
      const myapp = uniq('myapp');
      runCLI(
        `generate @nrwl/angular:app ${myapp} --unit-test-runner karma --no-interactive`
      );

      const mylib = uniq('mylib');
      runCLI(
        `generate @nrwl/angular:lib ${mylib} --unit-test-runner karma --add-module-spec --no-interactive`
      );
      patchKarmaToWorkOnWSL();

      await Promise.all([
        runCLIAsync(`generate @nrwl/angular:service test --project ${mylib}`),
        runCLIAsync(`generate @nrwl/angular:component test --project ${mylib}`),
      ]);

      const karmaResult = await runCLIAsync(`test ${mylib}`);
      expect(karmaResult.stdout).toContain('3 SUCCESS');

      await Promise.all([
        runCLIAsync(`generate @nrwl/angular:service test --project ${myapp}`),
        runCLIAsync(`generate @nrwl/angular:component test --project ${myapp}`),
      ]);
      const karmaResult2 = await runCLIAsync(`test ${myapp}`);
      expect(karmaResult2.stdout).toContain('5 SUCCESS');

      done();
    }, 60000);
  });
});
