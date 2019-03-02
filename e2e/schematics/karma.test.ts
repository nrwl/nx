import {
  newProject,
  runCLI,
  newLib,
  runCLIAsync,
  newApp,
  copyMissingPackages,
  ensureProject,
  uniq,
  patchKarmaToWorkOnWSL
} from '../utils';

describe('Karma', () => {
  it('should be able to generate a testable library using karma', async done => {
    ensureProject();
    const mylib = uniq('mylib');
    newLib(`${mylib} --unit-test-runner karma --framework=angular`);

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
    newApp(`${myapp} --unit-test-runner karma --framework=angular`);

    await Promise.all([
      runCLIAsync(`generate service test --project ${myapp}`),
      runCLIAsync(`generate component test --project ${myapp}`)
    ]);
    const karmaResult = await runCLIAsync(`test ${myapp}`);
    expect(karmaResult.stdout).toContain('5 SUCCESS');
    done();
  }, 30000);
});
