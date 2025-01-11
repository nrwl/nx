import {
  checkFilesExist,
  cleanupProject,
  newProject,
  readFile,
  runCLI,
  uniq,
  updateFile,
} from '@nx/e2e/utils';
import { classify } from '@nx/devkit/src/utils/string-utils';

describe('Move Angular Project', () => {
  let proj: string;
  let app1: string;
  let app2: string;
  let newPath: string;

  beforeAll(() => {
    proj = newProject({ packages: ['@nx/angular'] });
    app1 = uniq('app1');
    app2 = uniq('app2');
    newPath = `subfolder/${app2}`;
    runCLI(`generate @nx/angular:app ${app1} --no-interactive`);
  });

  afterAll(() => cleanupProject());

  /**
   * Tries moving an app from ${app1} -> subfolder/${app2}
   */
  it('should work for apps', () => {
    const moveOutput = runCLI(
      `generate @nx/angular:move --project ${app1} ${newPath} `
    );

    // just check the output
    expect(moveOutput).toContain(`DELETE ${app1}`);
    expect(moveOutput).toContain(`CREATE ${newPath}/jest.config.ts`);
    expect(moveOutput).toContain(`CREATE ${newPath}/tsconfig.app.json`);
    expect(moveOutput).toContain(`CREATE ${newPath}/tsconfig.json`);
    expect(moveOutput).toContain(`CREATE ${newPath}/tsconfig.spec.json`);
    expect(moveOutput).toContain(`CREATE ${newPath}/eslint.config.cjs`);
    expect(moveOutput).toContain(`CREATE ${newPath}/public/favicon.ico`);
    expect(moveOutput).toContain(`CREATE ${newPath}/src/index.html`);
    expect(moveOutput).toContain(`CREATE ${newPath}/src/main.ts`);
    expect(moveOutput).toContain(`CREATE ${newPath}/src/styles.css`);
    expect(moveOutput).toContain(`CREATE ${newPath}/src/test-setup.ts`);
    expect(moveOutput).toContain(
      `CREATE ${newPath}/src/app/app.component.html`
    );
    expect(moveOutput).toContain(`CREATE ${newPath}/src/app/app.component.ts`);
    expect(moveOutput).toContain(`CREATE ${newPath}/src/app/app.config.ts`);
  });

  /**
   * Tries moving an e2e project from ${app1} -> ${newPath}
   */
  it('should work for e2e projects w/custom cypress config', () => {
    // by default the cypress config doesn't contain any app specific paths
    // create a custom config with some app specific paths
    updateFile(
      `${app1}-e2e/cypress.config.ts`,
      `
  import { defineConfig } from 'cypress';
  import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
  
  export default defineConfig({
    e2e: {
      ...nxE2EPreset(__dirname),
      videosFolder: '../dist/cypress/${app1}-e2e/videos',
      screenshotsFolder: '../dist/cypress/${app1}-e2e/screenshots',
      },
  });
  `
    );
    const moveOutput = runCLI(
      `generate @nx/angular:move --projectName=${app1}-e2e --destination=${newPath}-e2e`
    );

    // just check that the cypress.config.ts is updated correctly
    const cypressConfigPath = `${newPath}-e2e/cypress.config.ts`;
    expect(moveOutput).toContain(`CREATE ${cypressConfigPath}`);
    checkFilesExist(cypressConfigPath);
    const cypressConfig = readFile(cypressConfigPath);

    expect(cypressConfig).toContain(`../../dist/cypress/${newPath}-e2e/videos`);
    expect(cypressConfig).toContain(
      `../../dist/cypress/${newPath}-e2e/screenshots`
    );
  });

  /**
   * Tries moving a library from ${lib} -> shared/${lib}
   */
  it('should work for libraries', () => {
    const lib1 = uniq('mylib');
    const lib2 = uniq('mylib');
    runCLI(`generate @nx/angular:lib ${lib1} --no-standalone --no-interactive`);

    /**
     * Create a library which imports the module from the other lib
     */

    runCLI(`generate @nx/angular:lib ${lib2} --no-standalone --no-interactive`);

    updateFile(
      `${lib2}/src/lib/${lib2}.module.ts`,
      `import { ${classify(lib1)}Module } from '@${proj}/${lib1}';
  
          export class ExtendedModule extends ${classify(lib1)}Module { }`
    );

    const moveOutput = runCLI(
      `generate @nx/angular:move --projectName=${lib1} --destination=shared/${lib1} --newProjectName=shared-${lib1}`
    );

    const newPath = `shared/${lib1}`;
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
    const lib2FilePath = `${lib2}/src/lib/${lib2}.module.ts`;
    const lib2File = readFile(lib2FilePath);
    expect(lib2File).toContain(
      `import { ${newModule} } from '@${proj}/shared-${lib1}';`
    );
    expect(lib2File).toContain(`extends ${newModule}`);
  });
});
