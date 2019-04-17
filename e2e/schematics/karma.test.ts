import { runCLI, runCLIAsync, ensureProject, uniq } from '../utils';

describe('Karma', () => {
  it('should be able to generate a testable library using karma', async done => {
    ensureProject();
    const mylib = uniq('mylib');
    runCLI(`generate @nrwl/angular:lib ${mylib} --unit-test-runner karma`);

    await Promise.all([
      runCLIAsync(`generate service test --project ${mylib}`),
      runCLIAsync(`generate component test --project ${mylib}`)
    ]);
    const karmaResult = await runCLIAsync(`test ${mylib}`);
    expect(karmaResult.stdout).toContain('3 SUCCESS');
    done();
  }, 30000);

  it('should be able to generate a testable application using karma', async done => {
    ensureProject();
    const myapp = uniq('myapp');
    runCLI(`generate @nrwl/angular:app ${myapp} --unit-test-runner karma`);

    await Promise.all([
      runCLIAsync(`generate service test --project ${myapp}`),
      runCLIAsync(`generate component test --project ${myapp}`)
    ]);
    const karmaResult = await runCLIAsync(`test ${myapp}`);
    expect(karmaResult.stdout).toContain('5 SUCCESS');
    done();
  }, 30000);
});
