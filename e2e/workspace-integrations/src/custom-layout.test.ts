import {
  checkFilesExist,
  readFile,
  readJson,
  runCLI,
  runCLIAsync,
  runCreateWorkspace,
  uniq,
  packagesInstall,
  removeProject,
  getSelectedPackageManager,
} from '@nrwl/e2e/utils';

describe('custom workspace layout', () => {
  afterAll(() => removeProject({ onlyOnCI: true }));

  it('should work', async () => {
    // TODO (meeroslav): what is the purpose of this test?
    //     const proj = uniq('custom-layout-proj');
    //     const packageManager = getSelectedPackageManager();
    //     runCreateWorkspace(proj, { preset: 'npm', packageManager });
    //     packagesInstall(['@nrwl/react','@nrwl/angular','@nrwl/express']);
    //     const nxJson = readJson('nx.json');
    //     expect(nxJson.extends).toEqual('@nrwl/workspace/presets/npm.json');
    //     const reactApp = uniq('reactapp');
    //     const reactLib = uniq('reactlib');
    //     const ngApp = uniq('ngapp');
    //     const ngLib = uniq('nglib');
    //     const expressApp = uniq('expessapp');
    //     const expressLib = uniq('expresslib');
    //     runCLI(`generate @nrwl/react:app ${reactApp} --no-interactive`);
    //     runCLI(`generate @nrwl/react:lib ${reactLib} --no-interactive`);
    //     runCLI(`generate @nrwl/angular:app ${ngApp} --no-interactive`);
    //     runCLI(`generate @nrwl/angular:lib ${ngLib} --no-interactive`);
    //     runCLI(`generate @nrwl/express:app ${expressApp} --no-interactive`);
    //     runCLI(`generate @nrwl/express:lib ${expressLib} --no-interactive`);
    //     checkFilesExist(
    //       `packages/${reactLib}/src/index.ts`,
    //       `packages/${reactApp}/src/main.tsx`,
    //       `packages/${reactApp}-e2e/cypress.json`,
    //       `packages/${ngLib}/src/index.ts`,
    //       `packages/${ngApp}/src/main.ts`,
    //       `packages/${ngApp}-e2e/cypress.json`,
    //       `packages/${expressLib}/src/index.ts`,
    //       `packages/${expressApp}/src/main.ts`
    //     );
    //     const workspaceJson = readFile('workspace.json');
    //     expect(workspaceJson).not.toContain('apps/');
    //     expect(workspaceJson).not.toContain('libs/');
    //     const libTestResults = await runCLIAsync(`test ${expressLib}`);
    //     expect(libTestResults.stdout).toContain(`nx run ${expressLib}:test`);
    //     const appBuildResults = await runCLIAsync(`build ${expressApp}`);
    //     expect(appBuildResults.stdout).toContain(`nx run ${expressApp}:build`);
    //     checkFilesExist(`dist/packages/${expressApp}/main.js`);
  }, 1000000);
});
