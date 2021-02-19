import * as path from 'path';
import {
  checkFilesExist,
  exists,
  newProject,
  readFile,
  readJson,
  removeProject,
  renameFile,
  runCLI,
  runCLIAsync,
  tmpProjPath,
  uniq,
  updateFile,
  workspaceConfigName,
} from '@nrwl/e2e/utils';
import { NxJson } from '@nrwl/workspace';
import { classify } from '@nrwl/workspace/src/utils/strings';

let proj: string;

beforeAll(() => {
  proj = newProject();
});

describe('lint', () => {
  it('lint should ensure module boundaries', () => {
    const myapp = uniq('myapp');
    const myapp2 = uniq('myapp2');
    const mylib = uniq('mylib');
    const lazylib = uniq('lazylib');
    const invalidtaglib = uniq('invalidtaglib');
    const validtaglib = uniq('validtaglib');

    runCLI(`generate @nrwl/angular:app ${myapp} --tags=validtag`);
    runCLI(`generate @nrwl/angular:app ${myapp2}`);
    runCLI(`generate @nrwl/angular:lib ${mylib}`);
    runCLI(`generate @nrwl/angular:lib ${lazylib}`);
    runCLI(`generate @nrwl/angular:lib ${invalidtaglib} --tags=invalidtag`);
    runCLI(`generate @nrwl/angular:lib ${validtaglib} --tags=validtag`);

    const eslint = readJson('.eslintrc.json');
    eslint.overrides[0].rules[
      '@nrwl/nx/enforce-module-boundaries'
    ][1].depConstraints = [
      { sourceTag: 'validtag', onlyDependOnLibsWithTags: ['validtag'] },
      ...eslint.overrides[0].rules['@nrwl/nx/enforce-module-boundaries'][1]
        .depConstraints,
    ];
    updateFile('.eslintrc.json', JSON.stringify(eslint, null, 2));

    const tsConfig = readJson('tsconfig.base.json');

    /**
     * apps do not add themselves to the tsconfig file.
     *
     * Let's add it so that we can trigger the lint failure
     */
    tsConfig.compilerOptions.paths[`@${proj}/${myapp2}`] = [
      `apps/${myapp2}/src/main.ts`,
    ];

    tsConfig.compilerOptions.paths[`@secondScope/${lazylib}`] =
      tsConfig.compilerOptions.paths[`@${proj}/${lazylib}`];
    delete tsConfig.compilerOptions.paths[`@${proj}/${lazylib}`];
    updateFile('tsconfig.base.json', JSON.stringify(tsConfig, null, 2));

    updateFile(
      `apps/${myapp}/src/main.ts`,
      `
      import '../../../libs/${mylib}';
      import '@secondScope/${lazylib}';
      import '@${proj}/${myapp2}';
      import '@${proj}/${invalidtaglib}';
      import '@${proj}/${validtaglib}';

      const s = {loadChildren: '@${proj}/${lazylib}'};
    `
    );

    const out = runCLI(`lint ${myapp}`, { silenceError: true });
    expect(out).toContain(
      'Libraries cannot be imported by a relative or absolute path, and must begin with a npm scope'
    );
    expect(out).toContain('Imports of lazy-loaded libraries are forbidden');
    expect(out).toContain('Imports of apps are forbidden');
    expect(out).toContain(
      'A project tagged with "validtag" can only depend on libs tagged with "validtag"'
    );
  }, 1000000);

  describe('nx workspace-lint', () => {
    it('should identify issues with the workspace', () => {
      const appBefore = uniq('before');
      const appAfter = uniq('after');

      runCLI(`generate @nrwl/angular:app ${appBefore}`);
      renameFile(`apps/${appBefore}`, `apps/${appAfter}`);

      const stdout = runCLI('workspace-lint', { silenceError: true });
      expect(stdout).toContain(
        `- Cannot find project '${appBefore}' in 'apps/${appBefore}'`
      );
      expect(stdout).toContain(
        'The following file(s) do not belong to any projects:'
      );
      expect(stdout).toContain(`- apps/${appAfter}/jest.config.js`);
      expect(stdout).toContain(`- apps/${appAfter}/src/app/app.component.css`);
      expect(stdout).toContain(`- apps/${appAfter}/src/app/app.component.html`);
      expect(stdout).toContain(
        `- apps/${appAfter}/src/app/app.component.spec.ts`
      );
    });
  });
});

describe('format', () => {
  it('should check and reformat the code', async () => {
    const myapp = uniq('myapp');
    const mylib = uniq('mylib');

    runCLI(`generate @nrwl/angular:app ${myapp}`);
    runCLI(`generate @nrwl/angular:lib ${mylib}`);
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

    let stdout = runCLI(
      `format:check --files="libs/${mylib}/index.ts,package.json" --libs-and-apps`,
      { silenceError: true }
    );
    expect(stdout).toContain(path.normalize(`libs/${mylib}/index.ts`));
    expect(stdout).toContain(
      path.normalize(`libs/${mylib}/src/${mylib}.module.ts`)
    );
    expect(stdout).not.toContain(path.normalize(`README.md`)); // It will be contained only in case of exception, that we fallback to all

    stdout = runCLI(`format:check --all`, { silenceError: true });
    expect(stdout).toContain(path.normalize(`apps/${myapp}/src/main.ts`));
    expect(stdout).toContain(
      path.normalize(`apps/${myapp}/src/app/app.module.ts`)
    );
    expect(stdout).toContain(
      path.normalize(`apps/${myapp}/src/app/app.component.ts`)
    );

    stdout = runCLI(`format:check --projects=${myapp}`, { silenceError: true });
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

    stdout = runCLI(`format:check --projects=${myapp},${mylib}`, {
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

    const { stderr } = await runCLIAsync(
      `format:check --projects=${myapp},${mylib} --all`,
      {
        silenceError: true,
      }
    );
    expect(stderr).toContain(
      'Arguments all and projects are mutually exclusive'
    );

    runCLI(
      `format:write --files="apps/${myapp}/src/app/app.module.ts,apps/${myapp}/src/app/app.component.ts"`
    );

    stdout = runCLI('format:check --all', { silenceError: true });
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
  });
});

describe('workspace-generator', () => {
  let custom: string;
  let failing: string;

  beforeEach(() => {
    custom = uniq('custom');
    failing = uniq('custom-failing');
    runCLI(`g workspace-generator ${custom} --no-interactive`);
    runCLI(`g workspace-generator ${failing} --no-interactive`);

    checkFilesExist(
      `tools/generators/${custom}/index.ts`,
      `tools/generators/${custom}/schema.json`
    );
    checkFilesExist(
      `tools/generators/${failing}/index.ts`,
      `tools/generators/${failing}/schema.json`
    );
  });

  it('should compile only generator files with dependencies', () => {
    const workspace = uniq('workspace');

    updateFile(
      'tools/utils/utils.ts',
      `
        export const noop = () => {}
        `
    );
    updateFile(
      'tools/utils/logger.ts',
      `
        export const log = (...args: any[]) => console.log(...args)
        `
    );
    updateFile(
      `tools/generators/utils.ts`,
      `
        export const noop = ()=>{}
        `
    );
    updateFile(`tools/generators/${custom}/index.ts`, (content) => {
      return `
          import { log } from '../../utils/logger'; \n
          ${content}
        `;
    });

    runCLI(`workspace-generator ${custom} ${workspace} --no-interactive -d`);

    expect(() =>
      checkFilesExist(
        `dist/out-tsc/tools/generators/${custom}/index.js`,
        `dist/out-tsc/tools/generators/utils.js`,
        `dist/out-tsc/tools/utils/logger.js`
      )
    ).not.toThrow();
    expect(() =>
      checkFilesExist(`dist/out-tsc/tools/utils/utils.js`)
    ).toThrow();
  });

  it('should support workspace-specific generators', async () => {
    const json = readJson(`tools/generators/${custom}/schema.json`);
    json.properties['directory'] = {
      type: 'string',
      description: 'lib directory',
    };
    json.properties['skipTsConfig'] = {
      type: 'boolean',
      description: 'skip changes to tsconfig',
    };
    updateFile(`tools/generators/${custom}/schema.json`, JSON.stringify(json));

    const indexFile = readFile(`tools/generators/${custom}/index.ts`);
    updateFile(
      `tools/generators/${custom}/index.ts`,
      indexFile.replace(
        'name: schema.name',
        'name: schema.name, directory: schema.directory, skipTsConfig: schema.skipTsConfig'
      )
    );

    const workspace = uniq('workspace');
    const dryRunOutput = runCLI(
      `workspace-generator ${custom} ${workspace} --no-interactive --directory=dir --skipTsConfig=true -d`
    );
    expect(exists(`libs/dir/${workspace}/src/index.ts`)).toEqual(false);
    expect(dryRunOutput).toContain(`UPDATE ${workspaceConfigName()}`);
    expect(dryRunOutput).toContain('UPDATE nx.json');

    const output = runCLI(
      `workspace-generator ${custom} ${workspace} --no-interactive --directory=dir`
    );
    checkFilesExist(`libs/dir/${workspace}/src/index.ts`);
    expect(output).toContain(`UPDATE ${workspaceConfigName()}`);
    expect(output).toContain('UPDATE nx.json');

    const jsonFailing = readJson(`tools/generators/${failing}/schema.json`);
    jsonFailing.properties = {};
    jsonFailing.required = [];
    updateFile(
      `tools/generators/${failing}/schema.json`,
      JSON.stringify(jsonFailing)
    );

    updateFile(
      `tools/generators/${failing}/index.ts`,
      `
          export default function() {
            throw new Error();
          }
        `
    );

    try {
      await runCLI(`workspace-generator ${failing} --no-interactive`);
      fail(`Should exit 1 for a workspace-generator that throws an error`);
    } catch (e) {}

    const listOutput = runCLI('workspace-generator --list-generators');
    expect(listOutput).toContain(custom);
    expect(listOutput).toContain(failing);
  }, 1000000);

  it('should support angular devkit schematics', () => {
    const angularDevkitSchematic = uniq('angular-devkit-schematic');
    runCLI(`g workspace-generator ${angularDevkitSchematic} --no-interactive`);

    const json = readJson(
      `tools/generators/${angularDevkitSchematic}/schema.json`
    );
    json.properties = {};
    json.required = [];
    delete json.cli;
    updateFile(
      `tools/generators/${angularDevkitSchematic}/schema.json`,
      JSON.stringify(json)
    );

    updateFile(
      `tools/generators/${angularDevkitSchematic}/index.ts`,
      `
          export default function() {
            return (tree) => tree;
          }
        `
    );

    runCLI(`workspace-generator ${angularDevkitSchematic} --no-interactive`);
  });
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
    myappE2e = myapp + '-e2e';
    myapp2E2e = myapp2 + '-e2e';
    myapp3E2e = myapp3 + '-e2e';
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

  it('dep-graph should output json to file', () => {
    runCLI(`dep-graph --file=project-graph.json`);

    expect(() => checkFilesExist('project-graph.json')).not.toThrow();

    const jsonFileContents = readJson('project-graph.json');

    expect(jsonFileContents.graph.dependencies).toEqual(
      jasmine.objectContaining({
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
    expect(() => checkFilesExist('static/runtime.js')).not.toThrow();
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

  afterEach(() => removeProject({ onlyOnCI: true }));

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
      `import { ${newModule} } from '@${proj}/shared/${lib1}';`
    );
    expect(lib2File).toContain(`extends ${newModule}`);
  });
});

describe('Move Project', () => {
  /**
   * Tries moving a library from ${lib}/data-access -> shared/${lib}/data-access
   */
  it('should work for libraries', () => {
    const proj = newProject();
    const lib1 = uniq('mylib');
    const lib2 = uniq('mylib');
    const lib3 = uniq('mylib');
    runCLI(`generate @nrwl/workspace:lib ${lib1}/data-access`);

    updateFile(
      `libs/${lib1}/data-access/src/lib/${lib1}-data-access.ts`,
      `export function fromLibOne() { console.log('This is completely pointless'); }`
    );

    updateFile(
      `libs/${lib1}/data-access/src/index.ts`,
      `export * from './lib/${lib1}-data-access.ts'`
    );

    /**
     * Create a library which imports a class from lib1
     */

    runCLI(`generate @nrwl/workspace:lib ${lib2}/ui`);

    updateFile(
      `libs/${lib2}/ui/src/lib/${lib2}-ui.ts`,
      `import { fromLibOne } from '@${proj}/${lib1}/data-access';

        export const fromLibTwo = () => fromLibOne();`
    );

    /**
     * Create a library which has an implicit dependency on lib1
     */

    runCLI(`generate @nrwl/workspace:lib ${lib3}`);
    let nxJson = JSON.parse(readFile('nx.json')) as NxJson;
    nxJson.projects[lib3].implicitDependencies = [`${lib1}-data-access`];
    updateFile(`nx.json`, JSON.stringify(nxJson));

    /**
     * Now try to move lib1
     */

    const moveOutput = runCLI(
      `generate @nrwl/workspace:move --project ${lib1}-data-access shared/${lib1}/data-access`
    );

    expect(moveOutput).toContain(`DELETE libs/${lib1}/data-access`);
    expect(exists(`libs/${lib1}/data-access`)).toBeFalsy();

    const newPath = `libs/shared/${lib1}/data-access`;
    const newName = `shared-${lib1}-data-access`;

    const readmePath = `${newPath}/README.md`;
    expect(moveOutput).toContain(`CREATE ${readmePath}`);
    checkFilesExist(readmePath);

    const jestConfigPath = `${newPath}/jest.config.js`;
    expect(moveOutput).toContain(`CREATE ${jestConfigPath}`);
    checkFilesExist(jestConfigPath);
    const jestConfig = readFile(jestConfigPath);
    expect(jestConfig).toContain(`displayName: 'shared-${lib1}-data-access'`);
    expect(jestConfig).toContain(`preset: '../../../../jest.preset.js'`);
    expect(jestConfig).toContain(`'../../../../coverage/${newPath}'`);

    const tsConfigPath = `${newPath}/tsconfig.json`;
    expect(moveOutput).toContain(`CREATE ${tsConfigPath}`);
    checkFilesExist(tsConfigPath);

    const tsConfigLibPath = `${newPath}/tsconfig.lib.json`;
    expect(moveOutput).toContain(`CREATE ${tsConfigLibPath}`);
    checkFilesExist(tsConfigLibPath);
    const tsConfigLib = readJson(tsConfigLibPath);
    expect(tsConfigLib.compilerOptions.outDir).toEqual(
      '../../../../dist/out-tsc'
    );

    const tsConfigSpecPath = `${newPath}/tsconfig.spec.json`;
    expect(moveOutput).toContain(`CREATE ${tsConfigSpecPath}`);
    checkFilesExist(tsConfigSpecPath);
    const tsConfigSpec = readJson(tsConfigSpecPath);
    expect(tsConfigSpec.compilerOptions.outDir).toEqual(
      '../../../../dist/out-tsc'
    );

    const indexPath = `${newPath}/src/index.ts`;
    expect(moveOutput).toContain(`CREATE ${indexPath}`);
    checkFilesExist(indexPath);

    const rootClassPath = `${newPath}/src/lib/${lib1}-data-access.ts`;
    expect(moveOutput).toContain(`CREATE ${rootClassPath}`);
    checkFilesExist(rootClassPath);

    expect(moveOutput).toContain('UPDATE nx.json');
    nxJson = JSON.parse(readFile('nx.json')) as NxJson;
    expect(nxJson.projects[`${lib1}-data-access`]).toBeUndefined();
    expect(nxJson.projects[newName]).toEqual({
      tags: [],
    });
    expect(nxJson.projects[lib3].implicitDependencies).toEqual([
      `shared-${lib1}-data-access`,
    ]);

    expect(moveOutput).toContain('UPDATE tsconfig.base.json');
    const rootTsConfig = readJson('tsconfig.base.json');
    expect(
      rootTsConfig.compilerOptions.paths[`@${proj}/${lib1}/data-access`]
    ).toBeUndefined();
    expect(
      rootTsConfig.compilerOptions.paths[`@${proj}/shared/${lib1}/data-access`]
    ).toEqual([`libs/shared/${lib1}/data-access/src/index.ts`]);

    expect(moveOutput).toContain(`UPDATE workspace.json`);
    const workspaceJson = readJson(`workspace.json`);
    expect(workspaceJson.projects[`${lib1}-data-access`]).toBeUndefined();
    const project = workspaceJson.projects[newName];
    expect(project).toBeTruthy();
    expect(project.root).toBe(newPath);
    expect(project.sourceRoot).toBe(`${newPath}/src`);
    expect(project.targets.lint.options.lintFilePatterns).toEqual([
      `libs/shared/${lib1}/data-access/**/*.ts`,
    ]);

    /**
     * Check that the import in lib2 has been updated
     */
    const lib2FilePath = `libs/${lib2}/ui/src/lib/${lib2}-ui.ts`;
    const lib2File = readFile(lib2FilePath);
    expect(lib2File).toContain(
      `import { fromLibOne } from '@${proj}/shared/${lib1}/data-access';`
    );
  });

  it('should work for libs created with --importPath', () => {
    const proj = newProject();
    const importPath = '@wibble/fish';
    const lib1 = uniq('mylib');
    const lib2 = uniq('mylib');
    const lib3 = uniq('mylib');
    runCLI(
      `generate @nrwl/workspace:lib ${lib1}/data-access --importPath=${importPath}`
    );

    updateFile(
      `libs/${lib1}/data-access/src/lib/${lib1}-data-access.ts`,
      `export function fromLibOne() { console.log('This is completely pointless'); }`
    );

    updateFile(
      `libs/${lib1}/data-access/src/index.ts`,
      `export * from './lib/${lib1}-data-access.ts'`
    );

    /**
     * Create a library which imports a class from lib1
     */

    runCLI(`generate @nrwl/workspace:lib ${lib2}/ui`);

    updateFile(
      `libs/${lib2}/ui/src/lib/${lib2}-ui.ts`,
      `import { fromLibOne } from '${importPath}';

        export const fromLibTwo = () => fromLibOne();`
    );

    /**
     * Create a library which has an implicit dependency on lib1
     */

    runCLI(`generate @nrwl/workspace:lib ${lib3}`);
    let nxJson = JSON.parse(readFile('nx.json')) as NxJson;
    nxJson.projects[lib3].implicitDependencies = [`${lib1}-data-access`];
    updateFile(`nx.json`, JSON.stringify(nxJson));

    /**
     * Now try to move lib1
     */

    const moveOutput = runCLI(
      `generate @nrwl/workspace:move --project ${lib1}-data-access shared/${lib1}/data-access`
    );

    expect(moveOutput).toContain(`DELETE libs/${lib1}/data-access`);
    expect(exists(`libs/${lib1}/data-access`)).toBeFalsy();

    const newPath = `libs/shared/${lib1}/data-access`;
    const newName = `shared-${lib1}-data-access`;

    const readmePath = `${newPath}/README.md`;
    expect(moveOutput).toContain(`CREATE ${readmePath}`);
    checkFilesExist(readmePath);

    const jestConfigPath = `${newPath}/jest.config.js`;
    expect(moveOutput).toContain(`CREATE ${jestConfigPath}`);
    checkFilesExist(jestConfigPath);
    const jestConfig = readFile(jestConfigPath);
    expect(jestConfig).toContain(`displayName: 'shared-${lib1}-data-access'`);
    expect(jestConfig).toContain(`preset: '../../../../jest.preset.js'`);
    expect(jestConfig).toContain(`'../../../../coverage/${newPath}'`);

    const tsConfigPath = `${newPath}/tsconfig.json`;
    expect(moveOutput).toContain(`CREATE ${tsConfigPath}`);
    checkFilesExist(tsConfigPath);

    const tsConfigLibPath = `${newPath}/tsconfig.lib.json`;
    expect(moveOutput).toContain(`CREATE ${tsConfigLibPath}`);
    checkFilesExist(tsConfigLibPath);
    const tsConfigLib = readJson(tsConfigLibPath);
    expect(tsConfigLib.compilerOptions.outDir).toEqual(
      '../../../../dist/out-tsc'
    );

    const tsConfigSpecPath = `${newPath}/tsconfig.spec.json`;
    expect(moveOutput).toContain(`CREATE ${tsConfigSpecPath}`);
    checkFilesExist(tsConfigSpecPath);
    const tsConfigSpec = readJson(tsConfigSpecPath);
    expect(tsConfigSpec.compilerOptions.outDir).toEqual(
      '../../../../dist/out-tsc'
    );

    const indexPath = `${newPath}/src/index.ts`;
    expect(moveOutput).toContain(`CREATE ${indexPath}`);
    checkFilesExist(indexPath);

    const rootClassPath = `${newPath}/src/lib/${lib1}-data-access.ts`;
    expect(moveOutput).toContain(`CREATE ${rootClassPath}`);
    checkFilesExist(rootClassPath);

    expect(moveOutput).toContain('UPDATE nx.json');
    nxJson = JSON.parse(readFile('nx.json')) as NxJson;
    expect(nxJson.projects[`${lib1}-data-access`]).toBeUndefined();
    expect(nxJson.projects[newName]).toEqual({
      tags: [],
    });
    expect(nxJson.projects[lib3].implicitDependencies).toEqual([
      `shared-${lib1}-data-access`,
    ]);

    expect(moveOutput).toContain('UPDATE tsconfig.base.json');
    const rootTsConfig = readJson('tsconfig.base.json');
    expect(
      rootTsConfig.compilerOptions.paths[`@${proj}/${lib1}/data-access`]
    ).toBeUndefined();
    expect(
      rootTsConfig.compilerOptions.paths[`@${proj}/shared/${lib1}/data-access`]
    ).toEqual([`libs/shared/${lib1}/data-access/src/index.ts`]);

    expect(moveOutput).toContain(`UPDATE workspace.json`);
    const workspaceJson = readJson(`workspace.json`);
    expect(workspaceJson.projects[`${lib1}-data-access`]).toBeUndefined();
    const project = workspaceJson.projects[newName];
    expect(project).toBeTruthy();
    expect(project.root).toBe(newPath);
    expect(project.sourceRoot).toBe(`${newPath}/src`);

    expect(project.targets.lint.options.lintFilePatterns).toEqual([
      `libs/shared/${lib1}/data-access/**/*.ts`,
    ]);

    /**
     * Check that the import in lib2 has been updated
     */
    const lib2FilePath = `libs/${lib2}/ui/src/lib/${lib2}-ui.ts`;
    const lib2File = readFile(lib2FilePath);
    expect(lib2File).toContain(
      `import { fromLibOne } from '@${proj}/shared/${lib1}/data-access';`
    );
  });

  it('should work for custom workspace layouts', () => {
    const proj = newProject();
    const lib1 = uniq('mylib');
    const lib2 = uniq('mylib');
    const lib3 = uniq('mylib');

    let nxJson = readJson('nx.json');
    nxJson.workspaceLayout = { libsDir: 'packages' };
    updateFile('nx.json', JSON.stringify(nxJson));

    runCLI(`generate @nrwl/workspace:lib ${lib1}/data-access`);

    updateFile(
      `packages/${lib1}/data-access/src/lib/${lib1}-data-access.ts`,
      `export function fromLibOne() { console.log('This is completely pointless'); }`
    );

    updateFile(
      `packages/${lib1}/data-access/src/index.ts`,
      `export * from './lib/${lib1}-data-access.ts'`
    );

    /**
     * Create a library which imports a class from lib1
     */

    runCLI(`generate @nrwl/workspace:lib ${lib2}/ui`);

    updateFile(
      `packages/${lib2}/ui/src/lib/${lib2}-ui.ts`,
      `import { fromLibOne } from '@${proj}/${lib1}/data-access';

        export const fromLibTwo = () => fromLibOne();`
    );

    /**
     * Create a library which has an implicit dependency on lib1
     */

    runCLI(`generate @nrwl/workspace:lib ${lib3}`);
    nxJson = JSON.parse(readFile('nx.json')) as NxJson;
    nxJson.projects[lib3].implicitDependencies = [`${lib1}-data-access`];
    updateFile(`nx.json`, JSON.stringify(nxJson));

    /**
     * Now try to move lib1
     */

    const moveOutput = runCLI(
      `generate @nrwl/workspace:move --project ${lib1}-data-access shared/${lib1}/data-access`
    );

    expect(moveOutput).toContain(`DELETE packages/${lib1}/data-access`);
    expect(exists(`packages/${lib1}/data-access`)).toBeFalsy();

    const newPath = `packages/shared/${lib1}/data-access`;
    const newName = `shared-${lib1}-data-access`;

    const readmePath = `${newPath}/README.md`;
    expect(moveOutput).toContain(`CREATE ${readmePath}`);
    checkFilesExist(readmePath);

    const jestConfigPath = `${newPath}/jest.config.js`;
    expect(moveOutput).toContain(`CREATE ${jestConfigPath}`);
    checkFilesExist(jestConfigPath);
    const jestConfig = readFile(jestConfigPath);
    expect(jestConfig).toContain(`displayName: 'shared-${lib1}-data-access'`);
    expect(jestConfig).toContain(`preset: '../../../../jest.preset.js'`);
    expect(jestConfig).toContain(`'../../../../coverage/${newPath}'`);

    const tsConfigPath = `${newPath}/tsconfig.json`;
    expect(moveOutput).toContain(`CREATE ${tsConfigPath}`);
    checkFilesExist(tsConfigPath);

    const tsConfigLibPath = `${newPath}/tsconfig.lib.json`;
    expect(moveOutput).toContain(`CREATE ${tsConfigLibPath}`);
    checkFilesExist(tsConfigLibPath);
    const tsConfigLib = readJson(tsConfigLibPath);
    expect(tsConfigLib.compilerOptions.outDir).toEqual(
      '../../../../dist/out-tsc'
    );

    const tsConfigSpecPath = `${newPath}/tsconfig.spec.json`;
    expect(moveOutput).toContain(`CREATE ${tsConfigSpecPath}`);
    checkFilesExist(tsConfigSpecPath);
    const tsConfigSpec = readJson(tsConfigSpecPath);
    expect(tsConfigSpec.compilerOptions.outDir).toEqual(
      '../../../../dist/out-tsc'
    );

    const indexPath = `${newPath}/src/index.ts`;
    expect(moveOutput).toContain(`CREATE ${indexPath}`);
    checkFilesExist(indexPath);

    const rootClassPath = `${newPath}/src/lib/${lib1}-data-access.ts`;
    expect(moveOutput).toContain(`CREATE ${rootClassPath}`);
    checkFilesExist(rootClassPath);

    expect(moveOutput).toContain('UPDATE nx.json');
    nxJson = JSON.parse(readFile('nx.json')) as NxJson;
    expect(nxJson.projects[`${lib1}-data-access`]).toBeUndefined();
    expect(nxJson.projects[newName]).toEqual({
      tags: [],
    });
    expect(nxJson.projects[lib3].implicitDependencies).toEqual([
      `shared-${lib1}-data-access`,
    ]);

    expect(moveOutput).toContain('UPDATE tsconfig.base.json');
    const rootTsConfig = readJson('tsconfig.base.json');
    expect(
      rootTsConfig.compilerOptions.paths[`@${proj}/${lib1}/data-access`]
    ).toBeUndefined();
    expect(
      rootTsConfig.compilerOptions.paths[`@${proj}/shared/${lib1}/data-access`]
    ).toEqual([`packages/shared/${lib1}/data-access/src/index.ts`]);

    expect(moveOutput).toContain(`UPDATE workspace.json`);
    const workspaceJson = readJson(`workspace.json`);
    expect(workspaceJson.projects[`${lib1}-data-access`]).toBeUndefined();
    const project = workspaceJson.projects[newName];
    expect(project).toBeTruthy();
    expect(project.root).toBe(newPath);
    expect(project.sourceRoot).toBe(`${newPath}/src`);
    expect(project.targets.lint.options.lintFilePatterns).toEqual([
      `packages/shared/${lib1}/data-access/**/*.ts`,
    ]);

    /**
     * Check that the import in lib2 has been updated
     */
    const lib2FilePath = `packages/${lib2}/ui/src/lib/${lib2}-ui.ts`;
    const lib2File = readFile(lib2FilePath);
    expect(lib2File).toContain(
      `import { fromLibOne } from '@${proj}/shared/${lib1}/data-access';`
    );

    nxJson = readJson('nx.json');
    delete nxJson.workspaceLayout;
    updateFile('nx.json', JSON.stringify(nxJson));
  });
});

describe('Remove Project', () => {
  /**
   * Tries creating then deleting a lib
   */
  it('should work', () => {
    newProject();
    const lib1 = uniq('mylib');
    const lib2 = uniq('mylib');

    runCLI(`generate @nrwl/workspace:lib ${lib1}`);
    expect(exists(tmpProjPath(`libs/${lib1}`))).toBeTruthy();

    /**
     * Create a library which has an implicit dependency on lib1
     */

    runCLI(`generate @nrwl/workspace:lib ${lib2}`);
    let nxJson = JSON.parse(readFile('nx.json')) as NxJson;
    nxJson.projects[lib2].implicitDependencies = [lib1];
    updateFile(`nx.json`, JSON.stringify(nxJson));

    /**
     * Try removing the project (should fail)
     */

    let error;
    try {
      runCLI(`generate @nrwl/workspace:remove --project ${lib1}`);
    } catch (e) {
      error = e;
    }

    expect(error).toBeDefined();
    expect(error.stderr.toString()).toContain(
      `${lib1} is still depended on by the following projects:\n${lib2}`
    );

    /**
     * Try force removing the project
     */

    const removeOutputForced = runCLI(
      `generate @nrwl/workspace:remove --project ${lib1} --forceRemove`
    );

    expect(removeOutputForced).toContain(`DELETE libs/${lib1}`);
    expect(exists(tmpProjPath(`libs/${lib1}`))).toBeFalsy();

    expect(removeOutputForced).toContain(`UPDATE nx.json`);
    nxJson = JSON.parse(readFile('nx.json')) as NxJson;
    expect(nxJson.projects[`${lib1}`]).toBeUndefined();
    expect(nxJson.projects[lib2].implicitDependencies).toEqual([]);

    expect(removeOutputForced).toContain(`UPDATE workspace.json`);
    const workspaceJson = readJson(`workspace.json`);
    expect(workspaceJson.projects[`${lib1}`]).toBeUndefined();
  });
});
