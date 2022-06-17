import {
  checkFilesExist,
  cleanupProject,
  newProject,
  readFile,
  readJson,
  runCLI,
  uniq,
  updateFile,
} from '@nrwl/e2e/utils';
import { classify } from '@nrwl/workspace/src/utils/strings';

describe('Move Angular Project', () => {
  let proj: string;
  let app1: string;
  let app2: string;
  let newPath: string;

  beforeAll(() => {
    proj = newProject();
    app1 = uniq('app1');
    app2 = uniq('app2');
    newPath = `subfolder/${app2}`;
    runCLI(`generate @nrwl/angular:app ${app1}`);
  });

  afterAll(() => cleanupProject());

  /**
   * Tries moving an app from ${app1} -> subfolder/${app2}
   */
  it('should work for apps', () => {
    const moveOutput = runCLI(
      `generate @nrwl/angular:move --project ${app1} ${newPath}`
    );

    // just check the output
    expect(moveOutput).toContain(`DELETE apps/${app1}`);
    expect(moveOutput).toContain(`CREATE apps/${newPath}/.browserslistrc`);
    expect(moveOutput).toContain(`CREATE apps/${newPath}/jest.config.ts`);
    expect(moveOutput).toContain(`CREATE apps/${newPath}/tsconfig.app.json`);
    expect(moveOutput).toContain(`CREATE apps/${newPath}/tsconfig.json`);
    expect(moveOutput).toContain(`CREATE apps/${newPath}/tsconfig.spec.json`);
    expect(moveOutput).toContain(`CREATE apps/${newPath}/.eslintrc.json`);
    expect(moveOutput).toContain(`CREATE apps/${newPath}/src/favicon.ico`);
    expect(moveOutput).toContain(`CREATE apps/${newPath}/src/index.html`);
    expect(moveOutput).toContain(`CREATE apps/${newPath}/src/main.ts`);
    expect(moveOutput).toContain(`CREATE apps/${newPath}/src/polyfills.ts`);
    expect(moveOutput).toContain(`CREATE apps/${newPath}/src/styles.css`);
    expect(moveOutput).toContain(`CREATE apps/${newPath}/src/test-setup.ts`);
    expect(moveOutput).toContain(
      `CREATE apps/${newPath}/src/app/app.component.html`
    );
    expect(moveOutput).toContain(
      `CREATE apps/${newPath}/src/app/app.module.ts`
    );
    expect(moveOutput).toContain(`CREATE apps/${newPath}/src/assets/.gitkeep`);
    expect(moveOutput).toContain(
      `CREATE apps/${newPath}/src/environments/environment.prod.ts`
    );
    expect(moveOutput).toContain(
      `CREATE apps/${newPath}/src/environments/environment.ts`
    );
    expect(moveOutput).toContain(`UPDATE workspace.json`);
  });

  /**
   * Tries moving an e2e project from ${app1} -> ${newPath}
   */
  it('should work for e2e projects', () => {
    const moveOutput = runCLI(
      `generate @nrwl/angular:move --projectName=${app1}-e2e --destination=${newPath}-e2e`
    );

    // just check that the cypress.json is updated correctly
    const cypressJsonPath = `apps/${newPath}-e2e/cypress.json`;
    expect(moveOutput).toContain(`CREATE ${cypressJsonPath}`);
    checkFilesExist(cypressJsonPath);
    const cypressJson = readJson(cypressJsonPath);
    expect(cypressJson.videosFolder).toEqual(
      `../../../dist/cypress/apps/${newPath}-e2e/videos`
    );
    expect(cypressJson.screenshotsFolder).toEqual(
      `../../../dist/cypress/apps/${newPath}-e2e/screenshots`
    );
  });

  /**
   * Tries moving a library from ${lib} -> shared/${lib}
   */
  it('should work for libraries', () => {
    const lib1 = uniq('mylib');
    const lib2 = uniq('mylib');
    runCLI(`generate @nrwl/angular:lib ${lib1}`);

    /**
     * Create a library which imports the module from the other lib
     */

    runCLI(`generate @nrwl/angular:lib ${lib2}`);

    updateFile(
      `libs/${lib2}/src/lib/${lib2}.module.ts`,
      `import { ${classify(lib1)}Module } from '@${proj}/${lib1}';

        export class ExtendedModule extends ${classify(lib1)}Module { }`
    );

    const moveOutput = runCLI(
      `generate @nrwl/angular:move --projectName=${lib1} --destination=shared/${lib1}`
    );

    const newPath = `libs/shared/${lib1}`;
    const newModule = `Shared${classify(lib1)}Module`;

    const testSetupPath = `${newPath}/src/test-setup.ts`;
    expect(moveOutput).toContain(`CREATE ${testSetupPath}`);
    checkFilesExist(testSetupPath);

    const modulePath = `${newPath}/src/lib/shared-${lib1}.module.ts`;
    expect(moveOutput).toContain(`CREATE ${modulePath}`);
    checkFilesExist(modulePath);
    const moduleFile = readFile(modulePath);
    expect(moduleFile).toContain(`export class ${newModule}`);

    const indexPath = `${newPath}/src/index.ts`;
    expect(moveOutput).toContain(`CREATE ${indexPath}`);
    checkFilesExist(indexPath);
    const index = readFile(indexPath);
    expect(index).toContain(`export * from './lib/shared-${lib1}.module'`);

    /**
     * Check that the import in lib2 has been updated
     */
    const lib2FilePath = `libs/${lib2}/src/lib/${lib2}.module.ts`;
    const lib2File = readFile(lib2FilePath);
    expect(lib2File).toContain(
      `import { ${newModule} } from '@${proj}/shared-${lib1}';`
    );
    expect(lib2File).toContain(`extends ${newModule}`);
  });
});
