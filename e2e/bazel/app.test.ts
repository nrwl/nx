import {copyMissingPackages, checkFilesExists, cleanup, newApp, readFile, runCLI, runCommand, runSchematic, updateFile} from '../utils';

describe('application', () => {
  beforeEach(cleanup);

  fit('creates a new application in a workspace', () => {
    runSchematic('@nrwl/bazel:application --name=proj');
    runSchematic('@nrwl/bazel:app --name=myApp', {projectName: 'proj'});

    checkFilesExists(
        `proj/tsconfig.json`, `proj/WORKSPACE`, `proj/BUILD.bazel`, `proj/apps/my-app/BUILD.bazel`,
        `proj/apps/my-app/src/index.html`, `proj/apps/my-app/src/app/app.module.ts`,
        `proj/apps/my-app/src/app/app.component.ts`);

    expect(readFile('proj/apps/my-app/src/app/app.module.ts')).toContain('bootstrap: [AppComponent]');

    const cliConfig = JSON.parse(readFile('proj/.angular-cli.json'));
    expect(cliConfig.apps.length).toEqual(1);
    expect(cliConfig.apps[0].name).toEqual('myApp');
    expect(cliConfig.apps[0].root).toEqual('apps/my-app/src');
  });

  it('creates multiple applications in a workspace', () => {
    runSchematic('@nrwl/bazel:application --name=proj2');
    runSchematic('@nrwl/bazel:app --name=first', {projectName: 'proj2'});
    runSchematic('@nrwl/bazel:app --name=second', {projectName: 'proj2'});

    const cliConfig = JSON.parse(readFile('proj2/.angular-cli.json'));
    expect(cliConfig.apps[0].name).toEqual('first');
    expect(cliConfig.apps[0].root).toEqual('apps/first/src');
    expect(cliConfig.apps[1].name).toEqual('second');
    expect(cliConfig.apps[1].root).toEqual('apps/second/src');
  });
});
