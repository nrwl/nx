process.env.SELECTED_CLI = 'angular';

import {
  expectTestsPass,
  newProject,
  readJson,
  cleanupProject,
  runCLI,
  runCLIAsync,
  uniq,
  updateFile,
} from '@nrwl/e2e/utils';

describe('Angular Package', () => {
  beforeAll(() => newProject());
  afterAll(() => cleanupProject());
  describe('config compat', () => {
    it('should work', async () => {
      const myapp = uniq('myapp');
      runCLI(`generate @nrwl/angular:app ${myapp} --no-interactive`);

      // update the angular.json
      const workspaceJson = readJson(`angular.json`);
      workspaceJson.version = 2;
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
});

function updateConfig(targets: any) {
  const res = {};
  Object.entries(targets).forEach(([name, t]: any) => {
    t.executor = t.builder;
    delete t.builder;
    res[name] = t;
  });
  return res;
}
