import * as path from 'path';
import {
  checkFilesExist,
  fileExists,
  isNotWindows,
  isWindows,
  newProject,
  readFile,
  readJson,
  cleanupProject,
  runCLI,
  runCLIAsync,
  uniq,
  updateFile,
} from '@nrwl/e2e/utils';
import { classify } from '@nrwl/workspace/src/utils/strings';

let proj: string;

describe('format', () => {
  const myapp = uniq('myapp');
  const mylib = uniq('mylib');

  beforeAll(() => {
    proj = newProject();
    runCLI(`generate @nrwl/angular:app ${myapp}`);
    runCLI(`generate @nrwl/angular:lib ${mylib}`);
  });

  afterAll(() => cleanupProject());

  beforeEach(() => {
    updateFile(
      `apps/${myapp}/src/main.ts`,
      `
       const x = 1111;
  `
    );

    updateFile(
      `apps/${myapp}/src/app/app.module.ts`,
      `
       const y = 1111;
  `
    );

    updateFile(
      `apps/${myapp}/src/app/app.component.ts`,
      `
       const z = 1111;
  `
    );

    updateFile(
      `libs/${mylib}/index.ts`,
      `
       const x = 1111;
  `
    );
    updateFile(
      `libs/${mylib}/src/${mylib}.module.ts`,
      `
       const y = 1111;
  `
    );

    updateFile(
      `README.md`,
      `
       my new readme;
  `
    );
  });

  it('should check libs and apps specific files', async () => {
    if (isNotWindows()) {
      const stdout = runCLI(
        `format:check --files="libs/${mylib}/index.ts,package.json" --libs-and-apps`,
        { silenceError: true }
      );
      expect(stdout).toContain(path.normalize(`libs/${mylib}/index.ts`));
      expect(stdout).toContain(
        path.normalize(`libs/${mylib}/src/${mylib}.module.ts`)
      );
      expect(stdout).not.toContain(path.normalize(`README.md`)); // It will be contained only in case of exception, that we fallback to all
    }
  }, 90000);

  it('should check spoecific project', async () => {
    if (isNotWindows()) {
      const stdout = runCLI(`format:check --projects=${myapp}`, {
        silenceError: true,
      });
      expect(stdout).toContain(path.normalize(`apps/${myapp}/src/main.ts`));
      expect(stdout).toContain(
        path.normalize(`apps/${myapp}/src/app/app.module.ts`)
      );
      expect(stdout).toContain(
        path.normalize(`apps/${myapp}/src/app/app.component.ts`)
      );
      expect(stdout).not.toContain(path.normalize(`libs/${mylib}/index.ts`));
      expect(stdout).not.toContain(
        path.normalize(`libs/${mylib}/src/${mylib}.module.ts`)
      );
      expect(stdout).not.toContain(path.normalize(`README.md`));
    }
  }, 90000);

  it('should check multiple projects', async () => {
    if (isNotWindows()) {
      const stdout = runCLI(`format:check --projects=${myapp},${mylib}`, {
        silenceError: true,
      });
      expect(stdout).toContain(path.normalize(`apps/${myapp}/src/main.ts`));
      expect(stdout).toContain(
        path.normalize(`apps/${myapp}/src/app/app.module.ts`)
      );
      expect(stdout).toContain(
        path.normalize(`apps/${myapp}/src/app/app.component.ts`)
      );
      expect(stdout).toContain(path.normalize(`libs/${mylib}/index.ts`));
      expect(stdout).toContain(
        path.normalize(`libs/${mylib}/src/${mylib}.module.ts`)
      );
      expect(stdout).not.toContain(path.normalize(`README.md`));
    }
  }, 90000);

  it('should check all', async () => {
    if (isNotWindows()) {
      const stdout = runCLI(`format:check --all`, { silenceError: true });
      expect(stdout).toContain(path.normalize(`apps/${myapp}/src/main.ts`));
      expect(stdout).toContain(
        path.normalize(`apps/${myapp}/src/app/app.module.ts`)
      );
      expect(stdout).toContain(
        path.normalize(`apps/${myapp}/src/app/app.component.ts`)
      );
      expect(stdout).toContain(path.normalize(`libs/${mylib}/index.ts`));
      expect(stdout).toContain(
        path.normalize(`libs/${mylib}/src/${mylib}.module.ts`)
      );
      expect(stdout).toContain(path.normalize(`README.md`));
    }
  }, 90000);

  it('should throw error if passing both projects and --all param', async () => {
    if (isNotWindows()) {
      const { stderr } = await runCLIAsync(
        `format:check --projects=${myapp},${mylib} --all`,
        {
          silenceError: true,
        }
      );
      expect(stderr).toContain(
        'Arguments all and projects are mutually exclusive'
      );
    }
  }, 90000);

  it('should reformat the code', async () => {
    if (isNotWindows()) {
      runCLI(
        `format:write --files="apps/${myapp}/src/app/app.module.ts,apps/${myapp}/src/app/app.component.ts"`
      );
      const stdout = runCLI('format:check --all', { silenceError: true });
      expect(stdout).toContain(path.normalize(`apps/${myapp}/src/main.ts`));
      expect(stdout).not.toContain(
        path.normalize(`apps/${myapp}/src/app/app.module.ts`)
      );
      expect(stdout).not.toContain(
        path.normalize(`apps/${myapp}/src/app/app.component.ts`)
      );

      runCLI('format:write --all');
      expect(runCLI('format:check --all')).not.toContain(
        path.normalize(`apps/${myapp}/src/main.ts`)
      );
    }
  }, 300000);
});

describe('dep-graph', () => {
  let proj: string;
  let myapp: string;
  let myapp2: string;
  let myapp3: string;
  let myappE2e: string;
  let myapp2E2e: string;
  let myapp3E2e: string;
  let mylib: string;
  let mylib2: string;
  beforeAll(() => {
    proj = newProject();
    myapp = uniq('myapp');
    myapp2 = uniq('myapp2');
    myapp3 = uniq('myapp3');
    myappE2e = `${myapp}-e2e`;
    myapp2E2e = `${myapp2}-e2e`;
    myapp3E2e = `${myapp3}-e2e`;
    mylib = uniq('mylib');
    mylib2 = uniq('mylib2');

    runCLI(`generate @nrwl/angular:app ${myapp}`);
    runCLI(`generate @nrwl/angular:app ${myapp2}`);
    runCLI(`generate @nrwl/angular:app ${myapp3}`);
    runCLI(`generate @nrwl/angular:lib ${mylib}`);
    runCLI(`generate @nrwl/angular:lib ${mylib2}`);

    updateFile(
      `apps/${myapp}/src/main.ts`,
      `
      import '@${proj}/${mylib}';

      const s = {loadChildren: '@${proj}/${mylib2}'};
    `
    );

    updateFile(
      `apps/${myapp2}/src/app/app.component.spec.ts`,
      `import '@${proj}/${mylib}';`
    );

    updateFile(
      `libs/${mylib}/src/mylib.module.spec.ts`,
      `import '@${proj}/${mylib2}';`
    );
  });

  afterAll(() => cleanupProject());

  it('dep-graph should output json to file', () => {
    runCLI(`dep-graph --file=project-graph.json`);

    expect(() => checkFilesExist('project-graph.json')).not.toThrow();

    const jsonFileContents = readJson('project-graph.json');

    expect(jsonFileContents.graph.dependencies).toEqual(
      expect.objectContaining({
        [myapp3E2e]: [
          {
            source: myapp3E2e,
            target: myapp3,
            type: 'implicit',
          },
        ],
        [myapp2]: [
          {
            source: myapp2,
            target: mylib,
            type: 'static',
          },
        ],
        [myapp2E2e]: [
          {
            source: myapp2E2e,
            target: myapp2,
            type: 'implicit',
          },
        ],
        [mylib]: [
          {
            source: mylib,
            target: mylib2,
            type: 'static',
          },
        ],
        [mylib2]: [],
        [myapp]: [
          {
            source: myapp,
            target: mylib,
            type: 'static',
          },
          { source: myapp, target: mylib2, type: 'dynamic' },
        ],
        [myappE2e]: [
          {
            source: myappE2e,
            target: myapp,
            type: 'implicit',
          },
        ],
        [myapp3]: [],
      })
    );

    runCLI(
      `affected:dep-graph --files="libs/${mylib}/src/index.ts" --file="project-graph.json"`
    );

    expect(() => checkFilesExist('project-graph.json')).not.toThrow();

    const jsonFileContents2 = readJson('project-graph.json');

    expect(jsonFileContents2.criticalPath).toContain(myapp);
    expect(jsonFileContents2.criticalPath).toContain(myapp2);
    expect(jsonFileContents2.criticalPath).toContain(mylib);
    expect(jsonFileContents2.criticalPath).not.toContain(mylib2);
  }, 1000000);

  if (isNotWindows()) {
    it('dep-graph should output json to file by absolute path', () => {
      runCLI(`dep-graph --file=/tmp/project-graph.json`);

      expect(() => checkFilesExist('/tmp/project-graph.json')).not.toThrow();
    }, 1000000);
  }

  if (isWindows()) {
    it('dep-graph should output json to file by absolute path in Windows', () => {
      runCLI(`dep-graph --file=C:\\tmp\\project-graph.json`);

      expect(fileExists('C:\\tmp\\project-graph.json')).toBeTruthy();
    }, 1000000);
  }

  it('dep-graph should focus requested project', () => {
    runCLI(`dep-graph --focus=${myapp} --file=project-graph.json`);

    expect(() => checkFilesExist('project-graph.json')).not.toThrow();

    const jsonFileContents = readJson('project-graph.json');
    const projectNames = Object.keys(jsonFileContents.graph.nodes);

    expect(projectNames).toContain(myapp);
    expect(projectNames).toContain(mylib);
    expect(projectNames).toContain(mylib2);
    expect(projectNames).toContain(myappE2e);

    expect(projectNames).not.toContain(myapp2);
    expect(projectNames).not.toContain(myapp3);
    expect(projectNames).not.toContain(myapp2E2e);
    expect(projectNames).not.toContain(myapp3E2e);
  }, 1000000);

  it('dep-graph should exclude requested projects', () => {
    runCLI(
      `dep-graph --exclude=${myappE2e},${myapp2E2e},${myapp3E2e} --file=project-graph.json`
    );

    expect(() => checkFilesExist('project-graph.json')).not.toThrow();

    const jsonFileContents = readJson('project-graph.json');
    const projectNames = Object.keys(jsonFileContents.graph.nodes);

    expect(projectNames).toContain(myapp);
    expect(projectNames).toContain(mylib);
    expect(projectNames).toContain(mylib2);
    expect(projectNames).toContain(myapp2);
    expect(projectNames).toContain(myapp3);

    expect(projectNames).not.toContain(myappE2e);
    expect(projectNames).not.toContain(myapp2E2e);
    expect(projectNames).not.toContain(myapp3E2e);
  }, 1000000);

  it('dep-graph should exclude requested projects that were included by a focus', () => {
    runCLI(
      `dep-graph --focus=${myapp} --exclude=${myappE2e} --file=project-graph.json`
    );

    expect(() => checkFilesExist('project-graph.json')).not.toThrow();

    const jsonFileContents = readJson('project-graph.json');
    const projectNames = Object.keys(jsonFileContents.graph.nodes);

    expect(projectNames).toContain(myapp);
    expect(projectNames).toContain(mylib);
    expect(projectNames).toContain(mylib2);

    expect(projectNames).not.toContain(myappE2e);
    expect(projectNames).not.toContain(myapp2);
    expect(projectNames).not.toContain(myapp3);
    expect(projectNames).not.toContain(myapp2E2e);
    expect(projectNames).not.toContain(myapp3E2e);
  }, 1000000);

  it('dep-graph should output a deployable static website in an html file accompanied by a folder with static assets', () => {
    runCLI(`dep-graph --file=project-graph.html`);

    expect(() => checkFilesExist('project-graph.html')).not.toThrow();
    expect(() => checkFilesExist('static/styles.css')).not.toThrow();
    expect(() => checkFilesExist('static/runtime.esm.js')).not.toThrow();
    expect(() => checkFilesExist('static/polyfills.esm.js')).not.toThrow();
    expect(() => checkFilesExist('static/main.esm.js')).not.toThrow();
  });
});

describe('Move Angular Project', () => {
  let proj: string;
  let app1: string;
  let app2: string;
  let newPath: string;

  beforeEach(() => {
    proj = newProject();
    app1 = uniq('app1');
    app2 = uniq('app2');
    newPath = `subfolder/${app2}`;
    runCLI(`generate @nrwl/angular:app ${app1}`);
  });

  afterEach(() => cleanupProject());

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
    expect(moveOutput).toContain(`CREATE apps/${newPath}/jest.config.js`);
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
    expect(moveOutput).toContain(`UPDATE nx.json`);
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
