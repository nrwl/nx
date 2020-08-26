import { NxJson } from '@nrwl/workspace';
import { classify } from '@nrwl/workspace/src/utils/strings';
import {
  checkFilesExist,
  ensureProject,
  exists,
  forEachCli,
  newProject,
  readFile,
  readJson,
  runCLI,
  runCommand,
  runCommandAsync,
  tmpProjPath,
  uniq,
  updateFile,
  workspaceConfigName,
  setCurrentProjName,
  runCreateWorkspace,
} from '@nrwl/e2e/utils';

forEachCli((cli) => {
  describe('lint', () => {
    it('lint should ensure module boundaries', () => {
      ensureProject();

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

      const tslint = readJson('tslint.json');
      tslint.rules['nx-enforce-module-boundaries'][1].depConstraints = [
        { sourceTag: 'validtag', onlyDependOnLibsWithTags: ['validtag'] },
        ...tslint.rules['nx-enforce-module-boundaries'][1].depConstraints,
      ];
      updateFile('tslint.json', JSON.stringify(tslint, null, 2));

      const tsConfig = readJson('tsconfig.base.json');

      /**
       * apps do not add themselves to the tsconfig file.
       *
       * Let's add it so that we can trigger the lint failure
       */
      tsConfig.compilerOptions.paths[`@proj/${myapp2}`] = [
        `apps/${myapp2}/src/main.ts`,
      ];

      tsConfig.compilerOptions.paths[`@secondScope/${lazylib}`] =
        tsConfig.compilerOptions.paths[`@proj/${lazylib}`];
      delete tsConfig.compilerOptions.paths[`@proj/${lazylib}`];
      updateFile('tsconfig.base.json', JSON.stringify(tsConfig, null, 2));

      updateFile(
        `apps/${myapp}/src/main.ts`,
        `
      import '../../../libs/${mylib}';
      import '@secondScope/${lazylib}';
      import '@proj/${myapp2}';
      import '@proj/${invalidtaglib}';
      import '@proj/${validtaglib}';

      const s = {loadChildren: '@proj/${lazylib}'};
    `
      );

      const out = runCLI(`lint ${myapp}`, { silenceError: true });
      expect(out).toContain(
        'libraries cannot be imported by a relative or absolute path, and must begin with a npm scope'
      );
      expect(out).toContain('imports of lazy-loaded libraries are forbidden');
      expect(out).toContain('imports of apps are forbidden');
      expect(out).toContain(
        'A project tagged with "validtag" can only depend on libs tagged with "validtag"'
      );
    }, 1000000);

    describe('nx lint', () => {
      afterAll(() => {
        newProject();
      });

      it('should run nx lint', () => {
        ensureProject();
        const appBefore = uniq('before');
        const appAfter = uniq('after');

        runCLI(`generate @nrwl/angular:app ${appBefore}`);
        runCommand(`mv apps/${appBefore} apps/${appAfter}`);

        const stdout = runCommand('./node_modules/.bin/nx workspace-lint');
        expect(stdout).toContain(
          `- Cannot find project '${appBefore}' in 'apps/${appBefore}'`
        );
        expect(stdout).toContain(
          'The following file(s) do not belong to any projects:'
        );
        expect(stdout).toContain(`- apps/${appAfter}/jest.config.js`);
        expect(stdout).toContain(
          `- apps/${appAfter}/src/app/app.component.css`
        );
        expect(stdout).toContain(
          `- apps/${appAfter}/src/app/app.component.html`
        );
        expect(stdout).toContain(
          `- apps/${appAfter}/src/app/app.component.spec.ts`
        );
      });
    });

    it('format should check and reformat the code', () => {
      ensureProject();
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

      let stdout = runCommand(
        `npm run -s format:check -- --files="libs/${mylib}/index.ts,package.json" --libs-and-apps`
      );
      expect(stdout).toContain(`libs/${mylib}/index.ts`);
      expect(stdout).toContain(`libs/${mylib}/src/${mylib}.module.ts`);
      expect(stdout).not.toContain(`README.md`); // It will be contained only in case of exception, that we fallback to all

      stdout = runCommand(`npm run -s format:check -- --all`);
      expect(stdout).toContain(`apps/${myapp}/src/main.ts`);
      expect(stdout).toContain(`apps/${myapp}/src/app/app.module.ts`);
      expect(stdout).toContain(`apps/${myapp}/src/app/app.component.ts`);

      runCommand(
        `npm run format:write -- --files="apps/${myapp}/src/app/app.module.ts,apps/${myapp}/src/app/app.component.ts"`
      );

      stdout = runCommand('npm run -s format:check -- --all');

      expect(stdout).toContain(`apps/${myapp}/src/main.ts`);
      expect(stdout).not.toContain(`apps/${myapp}/src/app/app.module.ts`);
      expect(stdout).not.toContain(`apps/${myapp}/src/app/app.component.ts`);

      runCommand('npm run format:write -- --all');
      expect(runCommand('npm run -s format:check -- --all')).not.toContain(
        `apps/${myapp}/src/main.ts`
      );
    });

    it('should support workspace-specific schematics', async () => {
      ensureProject();
      const custom = uniq('custom');
      const failing = uniq('custom-failing');
      runCLI(`g workspace-schematic ${custom} --no-interactive`);
      runCLI(`g workspace-schematic ${failing} --no-interactive`);
      checkFilesExist(
        `tools/schematics/${custom}/index.ts`,
        `tools/schematics/${custom}/schema.json`
      );

      const json = readJson(`tools/schematics/${custom}/schema.json`);
      json.properties['directory'] = {
        type: 'string',
        description: 'lib directory',
      };
      json.properties['skipTsConfig'] = {
        type: 'boolean',
        description: 'skip changes to tsconfig',
      };
      updateFile(
        `tools/schematics/${custom}/schema.json`,
        JSON.stringify(json)
      );

      const indexFile = readFile(`tools/schematics/${custom}/index.ts`);
      updateFile(
        `tools/schematics/${custom}/index.ts`,
        indexFile.replace(
          'name: schema.name',
          'name: schema.name, directory: schema.directory, skipTsConfig: schema.skipTsConfig'
        )
      );

      const workspace = uniq('workspace');
      const dryRunOutput = runCommand(
        `npm run workspace-schematic ${custom} ${workspace} -- --no-interactive --directory=dir --skipTsConfig=true -d`
      );
      expect(exists(`libs/dir/${workspace}/src/index.ts`)).toEqual(false);
      expect(dryRunOutput).toContain(`UPDATE ${workspaceConfigName()}`);
      expect(dryRunOutput).toContain('UPDATE nx.json');
      expect(dryRunOutput).not.toContain('UPDATE tsconfig.base.json');

      const output = runCommand(
        `npm run workspace-schematic ${custom} ${workspace} -- --no-interactive --directory=dir`
      );
      checkFilesExist(`libs/dir/${workspace}/src/index.ts`);
      expect(output).toContain(`UPDATE ${workspaceConfigName()}`);
      expect(output).toContain('UPDATE nx.json');

      const another = uniq('another');
      runCLI(`g workspace-schematic ${another} --no-interactive`);

      const jsonFailing = readJson(`tools/schematics/${failing}/schema.json`);
      jsonFailing.properties = {};
      jsonFailing.required = [];
      updateFile(
        `tools/schematics/${failing}/schema.json`,
        JSON.stringify(jsonFailing)
      );

      updateFile(
        `tools/schematics/${failing}/index.ts`,
        `
          export default function() {
            throw new Error();
          }
        `
      );

      try {
        const err = await runCommandAsync(
          `npm run workspace-schematic -- ${failing} --no-interactive`
        );
        fail(`Should exit 1 for a workspace-schematic that throws an error`);
      } catch (e) {}

      const listSchematicsOutput = runCommand(
        'npm run workspace-schematic -- --list-schematics'
      );
      expect(listSchematicsOutput).toContain(
        'nx workspace-schematic "--list-schematics"'
      );
      expect(listSchematicsOutput).toContain(custom);
      expect(listSchematicsOutput).toContain(failing);
      expect(listSchematicsOutput).toContain(another);

      const promptOutput = runCommand(
        `npm run workspace-schematic ${custom} mylib2 --dry-run`
      );
      expect(promptOutput).toContain('UPDATE nx.json');
    }, 1000000);
  });

  describe('dep-graph', () => {
    beforeEach(() => {
      newProject();
      runCLI('generate @nrwl/angular:app myapp');
      runCLI('generate @nrwl/angular:app myapp2');
      runCLI('generate @nrwl/angular:app myapp3');
      runCLI('generate @nrwl/angular:lib mylib');
      runCLI('generate @nrwl/angular:lib mylib2');

      updateFile(
        'apps/myapp/src/main.ts',
        `
      import '@proj/mylib';

      const s = {loadChildren: '@proj/mylib2'};
    `
      );

      updateFile(
        'apps/myapp2/src/app/app.component.spec.ts',
        `import '@proj/mylib';`
      );

      updateFile(
        'libs/mylib/src/mylib.module.spec.ts',
        `import '@proj/mylib2';`
      );
    });

    it('dep-graph should output json to file', () => {
      runCommand(`npm run dep-graph -- --file=project-graph.json`);

      expect(() => checkFilesExist('project-graph.json')).not.toThrow();

      const jsonFileContents = readJson('project-graph.json');

      expect(jsonFileContents.graph.dependencies).toEqual({
        'myapp3-e2e': [
          {
            source: 'myapp3-e2e',
            target: 'myapp3',
            type: 'implicit',
          },
        ],
        myapp2: [
          {
            source: 'myapp2',
            target: 'mylib',
            type: 'static',
          },
        ],
        'myapp2-e2e': [
          {
            source: 'myapp2-e2e',
            target: 'myapp2',
            type: 'implicit',
          },
        ],
        mylib: [
          {
            source: 'mylib',
            target: 'mylib2',
            type: 'static',
          },
        ],
        mylib2: [],
        myapp: [
          {
            source: 'myapp',
            target: 'mylib',
            type: 'static',
          },
          { source: 'myapp', target: 'mylib2', type: 'dynamic' },
        ],
        'myapp-e2e': [
          {
            source: 'myapp-e2e',
            target: 'myapp',
            type: 'implicit',
          },
        ],
        myapp3: [],
      });

      runCommand(
        `npm run affected:dep-graph -- --files="libs/mylib/src/index.ts" --file="project-graph.json"`
      );

      expect(() => checkFilesExist('project-graph.json')).not.toThrow();

      const jsonFileContents2 = readJson('project-graph.json');

      expect(jsonFileContents2.criticalPath).toContain('myapp');
      expect(jsonFileContents2.criticalPath).toContain('myapp2');
      expect(jsonFileContents2.criticalPath).toContain('mylib');
      expect(jsonFileContents2.criticalPath).not.toContain('mylib2');
    }, 1000000);

    it('dep-graph should focus requested project', () => {
      runCommand(
        `npm run dep-graph -- --focus=myapp --file=project-graph.json`
      );

      expect(() => checkFilesExist('project-graph.json')).not.toThrow();

      const jsonFileContents = readJson('project-graph.json');
      const projectNames = Object.keys(jsonFileContents.graph.nodes);

      expect(projectNames).toContain('myapp');
      expect(projectNames).toContain('mylib');
      expect(projectNames).toContain('mylib2');
      expect(projectNames).toContain('myapp-e2e');

      expect(projectNames).not.toContain('myapp2');
      expect(projectNames).not.toContain('myapp3');
      expect(projectNames).not.toContain('myapp2-e2e');
      expect(projectNames).not.toContain('myapp3-e2e');
    }, 1000000);

    it('dep-graph should exclude requested projects', () => {
      runCommand(
        `npm run dep-graph -- --exclude=myapp-e2e,myapp2-e2e,myapp3-e2e --file=project-graph.json`
      );

      expect(() => checkFilesExist('project-graph.json')).not.toThrow();

      const jsonFileContents = readJson('project-graph.json');
      const projectNames = Object.keys(jsonFileContents.graph.nodes);

      expect(projectNames).toContain('myapp');
      expect(projectNames).toContain('mylib');
      expect(projectNames).toContain('mylib2');
      expect(projectNames).toContain('myapp2');
      expect(projectNames).toContain('myapp3');

      expect(projectNames).not.toContain('myapp-e2e');
      expect(projectNames).not.toContain('myapp2-e2e');
      expect(projectNames).not.toContain('myapp3-e2e');
    }, 1000000);

    it('dep-graph should exclude requested projects that were included by a focus', () => {
      runCommand(
        `npm run dep-graph -- --focus=myapp --exclude=myapp-e2e --file=project-graph.json`
      );

      expect(() => checkFilesExist('project-graph.json')).not.toThrow();

      const jsonFileContents = readJson('project-graph.json');
      const projectNames = Object.keys(jsonFileContents.graph.nodes);

      expect(projectNames).toContain('myapp');
      expect(projectNames).toContain('mylib');
      expect(projectNames).toContain('mylib2');

      expect(projectNames).not.toContain('myapp-e2e');
      expect(projectNames).not.toContain('myapp2');
      expect(projectNames).not.toContain('myapp3');
      expect(projectNames).not.toContain('myapp2-e2e');
      expect(projectNames).not.toContain('myapp3-e2e');
    }, 1000000);

    it('dep-graph should output a deployable static website in an html file accompanied by a folder with static assets', () => {
      runCommand(`npm run dep-graph -- --file=project-graph.html`);

      expect(() => checkFilesExist('project-graph.html')).not.toThrow();
      expect(() => checkFilesExist('static/dep-graph.css')).not.toThrow();
      expect(() => checkFilesExist('static/dep-graph.js')).not.toThrow();
      expect(() => checkFilesExist('static/vendor.js')).not.toThrow();
    });
  });

  describe('Move Angular Project', () => {
    const workspace: string = cli === 'angular' ? 'angular' : 'workspace';

    describe('Apps', () => {
      let app1: string;
      let app2: string;
      let newPath: string;

      beforeEach(() => {
        app1 = uniq('app1');
        app2 = uniq('app2');
        newPath = `subfolder/${app2}`;
        newProject();
        runCLI(`generate @nrwl/angular:app ${app1}`);
      });

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
        expect(moveOutput).toContain(
          `CREATE apps/${newPath}/tsconfig.app.json`
        );
        expect(moveOutput).toContain(`CREATE apps/${newPath}/tsconfig.json`);
        expect(moveOutput).toContain(
          `CREATE apps/${newPath}/tsconfig.spec.json`
        );
        expect(moveOutput).toContain(`CREATE apps/${newPath}/tslint.json`);
        expect(moveOutput).toContain(`CREATE apps/${newPath}/src/favicon.ico`);
        expect(moveOutput).toContain(`CREATE apps/${newPath}/src/index.html`);
        expect(moveOutput).toContain(`CREATE apps/${newPath}/src/main.ts`);
        expect(moveOutput).toContain(`CREATE apps/${newPath}/src/polyfills.ts`);
        expect(moveOutput).toContain(`CREATE apps/${newPath}/src/styles.css`);
        expect(moveOutput).toContain(
          `CREATE apps/${newPath}/src/test-setup.ts`
        );
        expect(moveOutput).toContain(
          `CREATE apps/${newPath}/src/app/app.component.html`
        );
        expect(moveOutput).toContain(
          `CREATE apps/${newPath}/src/app/app.module.ts`
        );
        expect(moveOutput).toContain(
          `CREATE apps/${newPath}/src/assets/.gitkeep`
        );
        expect(moveOutput).toContain(
          `CREATE apps/${newPath}/src/environments/environment.prod.ts`
        );
        expect(moveOutput).toContain(
          `CREATE apps/${newPath}/src/environments/environment.ts`
        );
        expect(moveOutput).toContain(`UPDATE nx.json`);
        expect(moveOutput).toContain(`UPDATE ${workspace}.json`);
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
    });

    /**
     * Tries moving a library from ${lib} -> shared/${lib}
     */
    it('should work for libraries', () => {
      const lib1 = uniq('mylib');
      const lib2 = uniq('mylib');
      newProject();
      runCLI(`generate @nrwl/angular:lib ${lib1}`);

      /**
       * Create a library which imports the module from the other lib
       */

      runCLI(`generate @nrwl/angular:lib ${lib2}`);

      updateFile(
        `libs/${lib2}/src/lib/${lib2}.module.ts`,
        `import { ${classify(lib1)}Module } from '@proj/${lib1}';

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
        `import { ${newModule} } from '@proj/shared/${lib1}';`
      );
      expect(lib2File).toContain(`extends ${newModule}`);
    });
  });

  describe('Move Project', () => {
    const workspace: string = cli === 'angular' ? 'angular' : 'workspace';

    /**
     * Tries moving a library from ${lib}/data-access -> shared/${lib}/data-access
     */
    it('should work for libraries', () => {
      const lib1 = uniq('mylib');
      const lib2 = uniq('mylib');
      const lib3 = uniq('mylib');
      newProject();
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
        `import { fromLibOne } from '@proj/${lib1}/data-access';

        export const fromLibTwo = () => fromLibOne(); }`
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
      expect(jestConfig).toContain(`name: 'shared-${lib1}-data-access'`);
      expect(jestConfig).toContain(`preset: '../../../../jest.config.js'`);
      expect(jestConfig).toContain(
        `coverageDirectory: '../../../../coverage/${newPath}'`
      );

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
        rootTsConfig.compilerOptions.paths[`@proj/${lib1}/data-access`]
      ).toBeUndefined();
      expect(
        rootTsConfig.compilerOptions.paths[`@proj/shared/${lib1}/data-access`]
      ).toEqual([`libs/shared/${lib1}/data-access/src/index.ts`]);

      expect(moveOutput).toContain(`UPDATE ${workspace}.json`);
      const workspaceJson = readJson(`${workspace}.json`);
      expect(workspaceJson.projects[`${lib1}-data-access`]).toBeUndefined();
      const project = workspaceJson.projects[newName];
      expect(project).toBeTruthy();
      expect(project.root).toBe(newPath);
      expect(project.sourceRoot).toBe(`${newPath}/src`);
      expect(project.architect.lint.options.tsConfig).toEqual([
        `libs/shared/${lib1}/data-access/tsconfig.lib.json`,
        `libs/shared/${lib1}/data-access/tsconfig.spec.json`,
      ]);

      /**
       * Check that the import in lib2 has been updated
       */
      const lib2FilePath = `libs/${lib2}/ui/src/lib/${lib2}-ui.ts`;
      const lib2File = readFile(lib2FilePath);
      expect(lib2File).toContain(
        `import { fromLibOne } from '@proj/shared/${lib1}/data-access';`
      );
    });

    it('should work for custom workspace layouts', () => {
      const lib1 = uniq('mylib');
      const lib2 = uniq('mylib');
      const lib3 = uniq('mylib');
      newProject();

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
        `import { fromLibOne } from '@proj/${lib1}/data-access';

        export const fromLibTwo = () => fromLibOne(); }`
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
      expect(jestConfig).toContain(`name: 'shared-${lib1}-data-access'`);
      expect(jestConfig).toContain(`preset: '../../../../jest.config.js'`);
      expect(jestConfig).toContain(
        `coverageDirectory: '../../../../coverage/${newPath}'`
      );

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
        rootTsConfig.compilerOptions.paths[`@proj/${lib1}/data-access`]
      ).toBeUndefined();
      expect(
        rootTsConfig.compilerOptions.paths[`@proj/shared/${lib1}/data-access`]
      ).toEqual([`packages/shared/${lib1}/data-access/src/index.ts`]);

      expect(moveOutput).toContain(`UPDATE ${workspace}.json`);
      const workspaceJson = readJson(`${workspace}.json`);
      expect(workspaceJson.projects[`${lib1}-data-access`]).toBeUndefined();
      const project = workspaceJson.projects[newName];
      expect(project).toBeTruthy();
      expect(project.root).toBe(newPath);
      expect(project.sourceRoot).toBe(`${newPath}/src`);
      expect(project.architect.lint.options.tsConfig).toEqual([
        `packages/shared/${lib1}/data-access/tsconfig.lib.json`,
        `packages/shared/${lib1}/data-access/tsconfig.spec.json`,
      ]);

      /**
       * Check that the import in lib2 has been updated
       */
      const lib2FilePath = `packages/${lib2}/ui/src/lib/${lib2}-ui.ts`;
      const lib2File = readFile(lib2FilePath);
      expect(lib2File).toContain(
        `import { fromLibOne } from '@proj/shared/${lib1}/data-access';`
      );
    });
  });

  describe('Remove Project', () => {
    const workspace: string = cli === 'angular' ? 'angular' : 'workspace';

    /**
     * Tries creating then deleting a lib
     */
    it('should work', () => {
      const lib1 = uniq('mylib');
      const lib2 = uniq('mylib');

      newProject();

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

      expect(removeOutputForced).toContain(`UPDATE ${workspace}.json`);
      const workspaceJson = readJson(`${workspace}.json`);
      expect(workspaceJson.projects[`${lib1}`]).toBeUndefined();
    });
  });
});
