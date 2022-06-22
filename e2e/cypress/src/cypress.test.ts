import {
  checkFilesExist,
  createFile,
  killPorts,
  newProject,
  readFile,
  readJson,
  runCLI,
  uniq,
  updateFile,
} from '@nrwl/e2e/utils';

describe('Cypress E2E Test runner', () => {
  beforeEach(() => newProject());

  it('should generate an app with the Cypress as e2e test runner', () => {
    newProject();
    const myapp = uniq('myapp');
    runCLI(
      `generate @nrwl/react:app ${myapp} --e2eTestRunner=cypress --linter=eslint`
    );

    // Making sure the package.json file contains the Cypress dependency
    const packageJson = readJson('package.json');
    expect(packageJson.devDependencies['cypress']).toBeTruthy();

    // Making sure the cypress folders & files are created
    checkFilesExist(`apps/${myapp}-e2e/cypress.json`);
    checkFilesExist(`apps/${myapp}-e2e/tsconfig.json`);

    checkFilesExist(`apps/${myapp}-e2e/src/fixtures/example.json`);
    checkFilesExist(`apps/${myapp}-e2e/src/integration/app.spec.ts`);
    checkFilesExist(`apps/${myapp}-e2e/src/support/app.po.ts`);
    checkFilesExist(`apps/${myapp}-e2e/src/support/index.ts`);
    checkFilesExist(`apps/${myapp}-e2e/src/support/commands.ts`);
  }, 1000000);

  it('should execute e2e tests using Cypress', async () => {
    newProject();
    const myapp = uniq('myapp');
    runCLI(
      `generate @nrwl/react:app ${myapp} --e2eTestRunner=cypress --linter=eslint`
    );

    // make sure arg parsing doesn't regress
    // https://github.com/nrwl/nx/issues/10808
    createFile(
      `apps/${myapp}-e2e/cypress.env.json`,
      JSON.stringify({
        NX_API_URL: 'http://localhost:1234',
      })
    );
    createFile(
      `apps/${myapp}-e2e/src/integration/args.spec.ts`,
      `
describe('args', () => {
  it('should have the correct args', () => {
    expect(Cypress.env('NX_API_URL')).eq('http://localhost:9000')
  });
});
    `
    );

    expect(
      runCLI(
        `e2e ${myapp}-e2e --env.NX_API_URL=http://localhost:9000 --no-watch`
      )
    ).toContain('All specs passed!');
    await killPorts(4200);
    const originalContents = JSON.parse(
      readFile(`apps/${myapp}-e2e/cypress.json`)
    );
    delete originalContents.fixturesFolder;
    updateFile(
      `apps/${myapp}-e2e/cypress.json`,
      JSON.stringify(originalContents)
    );

    expect(runCLI(`e2e ${myapp}-e2e --no-watch`)).toContain(
      'All specs passed!'
    );
    expect(await killPorts(4200)).toBeTruthy();
  }, 1000000);
});
