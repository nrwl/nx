import {
  newProject,
  runCLI,
  newLib,
  copyMissingPackages,
  updateFile,
  readJson,
  runCommand,
  runCLIAsync
} from '../utils';

describe('Jest', () => {
  beforeAll(() => {
    newProject();
    runCLI('generate jest', {
      silenceError: true
    });
    // TODO: remove this hack after there's a version of @nrwl/builders published
    const packageJson = readJson('package.json');
    packageJson.devDependencies['@nrwl/builders'] =
      '../../build/packages/builders';
    updateFile('package.json', JSON.stringify(packageJson));
    runCommand('npm install');
    copyMissingPackages();
  });

  it(
    'should be able to generate a testable library using jest',
    async done => {
      newLib('jestlib --unit-test-runner jest');
      await Promise.all([
        runCLIAsync('generate service test --project jestlib'),
        runCLIAsync('generate component test --project jestlib')
      ]);
      const jestResult = await runCLIAsync('test jestlib');
      expect(jestResult.stderr).toContain('Test Suites: 3 passed, 3 total');
      done();
    },
    10000
  );
});
