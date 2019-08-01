import {
  runCLI,
  runCLIAsync,
  ensureProject,
  uniq,
  forEachCli,
  supportUi,
  patchKarmaToWorkOnWSL
} from './utils';

forEachCli(() => {
  describe('Karma', () => {
    it('should be able to generate a testable library using karma', async done => {
      ensureProject();

      const mylib = uniq('mylib');
      runCLI(`generate @nrwl/angular:lib ${mylib} --unit-test-runner karma`);
      patchKarmaToWorkOnWSL();

      await Promise.all([
        runCLIAsync(`generate @nrwl/angular:service test --project ${mylib}`),
        runCLIAsync(`generate @nrwl/angular:component test --project ${mylib}`)
      ]);

      const karmaResult = await runCLIAsync(`test ${mylib}`);
      expect(karmaResult.stdout).toContain('3 SUCCESS');
      done();
    }, 30000);

    it('should be able to generate a testable application using karma', async done => {
      ensureProject();
      const myapp = uniq('myapp');
      runCLI(`generate @nrwl/angular:app ${myapp} --unit-test-runner karma`);
      patchKarmaToWorkOnWSL();

      await Promise.all([
        runCLIAsync(`generate @nrwl/angular:service test --project ${myapp}`),
        runCLIAsync(`generate @nrwl/angular:component test --project ${myapp}`)
      ]);
      const karmaResult = await runCLIAsync(`test ${myapp}`);
      expect(karmaResult.stdout).toContain('5 SUCCESS');
      done();
    }, 30000);
  });
});
