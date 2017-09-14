import {checkFilesExists, cleanup, copyMissingPackages, newApp, readFile, runCLI, runCommand, runSchematic, updateFile} from '../utils';

describe('application', () => {
  beforeEach(cleanup);

  it('creates a new application in a workspace', () => {
    runSchematic('@nrwl/bazel:application --name=proj');
    runSchematic('@nrwl/bazel:app --name=myApp');

    checkFilesExists(
        `tsconfig.json`, `WORKSPACE`, `BUILD.bazel`, `apps/my-app/BUILD.bazel`,
        `apps/my-app/src/index.html`, `apps/my-app/src/app/app.module.ts`,
        `apps/my-app/src/app/app.component.ts`);

    expect(readFile('apps/my-app/src/app/app.module.ts')).toContain('bootstrap: [AppComponent]');

    const cliConfig = JSON.parse(readFile('.angular-cli.json'));
    expect(cliConfig.apps.length).toEqual(1);
    expect(cliConfig.apps[0].name).toEqual('myApp');
    expect(cliConfig.apps[0].root).toEqual('apps/my-app/src');
  });

  it('creates multiple applications in a workspace', () => {
    runSchematic('@nrwl/bazel:application --name=proj');
    runSchematic('@nrwl/bazel:app --name=first');
    runSchematic('@nrwl/bazel:app --name=second');

    const cliConfig = JSON.parse(readFile('.angular-cli.json'));
    expect(cliConfig.apps[0].name).toEqual('first');
    expect(cliConfig.apps[0].root).toEqual('apps/first/src');
    expect(cliConfig.apps[1].name).toEqual('second');
    expect(cliConfig.apps[1].root).toEqual('apps/second/src');
  });
});
