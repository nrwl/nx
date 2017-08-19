import {
  addNgRx, checkFilesExists, cleanup, newApp, readFile, runCLI, runCommand, runSchematic,
  updateFile
} from './utils';

describe('application', () => {
  beforeEach(cleanup);

  it('creates a new application in a workspace', () => {
    runSchematic('@nrwl/nx:application --name=proj');
    runSchematic('@nrwl/nx:app --name=myapp', {projectName: 'proj'});

    checkFilesExists(
      `proj/tsconfig.json`,
      `proj/WORKSPACE`,
      `proj/BUILD.bazel`,
      `proj/apps/myapp/BUILD.bazel`,
      `proj/apps/myapp/src/index.html`,
      `proj/apps/myapp/src/app/app.module.ts`,
      `proj/apps/myapp/src/app/app.component.ts`
    );

    expect(readFile('proj/apps/myapp/src/app/app.module.ts')).toContain('bootstrap: [AppComponent]');

    const cliConfig = JSON.parse(readFile('proj/.angular-cli.json'));
    expect(cliConfig.apps.length).toEqual(1);
  });

  it('creates multiple applications in a workspace', () => {
    runSchematic('@nrwl/nx:application --name=proj2');
    runSchematic('@nrwl/nx:app --name=first', {projectName: 'proj2'});
    runSchematic('@nrwl/nx:app --name=second', {projectName: 'proj2'});

    const cliConfig = JSON.parse(readFile('proj2/.angular-cli.json'));
    expect(cliConfig.apps[0].name).toEqual('first');
    expect(cliConfig.apps[0].root).toEqual('apps/first/src');
    expect(cliConfig.apps[1].name).toEqual('second');
    expect(cliConfig.apps[1].root).toEqual('apps/second/src');
  });
});
