import {
  expectTestsPass,
  newProject,
  readJson,
  runCLI,
  runCLIAsync,
  uniq,
  updateFile,
} from '@nrwl/e2e/utils';

describe('new config format', () => {
  it('should work', async () => {
    newProject();

    const myapp = uniq('myapp');
    runCLI(`generate @nrwl/angular:app ${myapp} --no-interactive`);

    // update the angular.json
    const workspaceJson = readJson(`angular.json`);
    workspaceJson.projects[myapp].targets = updateConfig(
      workspaceJson.projects[myapp].architect
    );
    workspaceJson.generators = workspaceJson.schematics;
    delete workspaceJson.schematics;
    updateFile('angular.json', JSON.stringify(workspaceJson, null, 2));

    const myapp2 = uniq('myapp');
    runCLI(`generate @nrwl/angular:app ${myapp2} --no-interactive`);
    expectTestsPass(await runCLIAsync(`test ${myapp2} --no-watch`));
  }, 1000000);
});

function updateConfig(targets: any) {
  const res = {};
  Object.entries(targets).forEach(([name, t]: any) => {
    t.executor = t.builder;
    t.generators = t.schematics;
    delete t.builder;
    delete t.schematics;
    res[name] = t;
  });
  return res;
}
