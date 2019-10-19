import {
  checkFilesExist,
  newProject,
  readFile,
  readJson,
  runCLI,
  runCommand,
  updateFile,
  exists,
  ensureProject,
  uniq,
  forEachCli,
  workspaceConfigName
} from './utils';

forEachCli(() => {
  describe('Command line', () => {
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
        ...tslint.rules['nx-enforce-module-boundaries'][1].depConstraints
      ];
      updateFile('tslint.json', JSON.stringify(tslint, null, 2));

      updateFile(
        `apps/${myapp}/src/main.ts`,
        `
      import '../../../libs/${mylib}';
      import '@proj/${lazylib}';
      import '@proj/${mylib}/deep';
      import '@proj/${myapp2}';
      import '@proj/${invalidtaglib}';
      import '@proj/${validtaglib}';

      const s = {loadChildren: '@proj/${lazylib}'};
    `
      );

      const out = runCLI(`lint ${myapp}`, { silenceError: true });
      expect(out).toContain('library imports must start with @proj/');
      expect(out).toContain('imports of lazy-loaded libraries are forbidden');
      expect(out).toContain('deep imports into libraries are forbidden');
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
        expect(stdout).toContain(`- apps/${appAfter}/browserslist`);
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

      let stdout = runCommand(
        `npm run -s format:check -- --files="libs/${mylib}/index.ts" --libs-and-apps`
      );
      expect(stdout).toContain(`libs/${mylib}/index.ts`);
      expect(stdout).toContain(`libs/${mylib}/src/${mylib}.module.ts`);

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
      expect(runCommand('npm run -s format:check -- --all')).toEqual('');
    });

    it('should support workspace-specific schematics', () => {
      ensureProject();
      const custom = uniq('custom');
      runCLI(`g workspace-schematic ${custom} --no-interactive`);
      checkFilesExist(
        `tools/schematics/${custom}/index.ts`,
        `tools/schematics/${custom}/schema.json`
      );

      const json = readJson(`tools/schematics/${custom}/schema.json`);
      json.properties['directory'] = {
        type: 'string',
        description: 'lib directory'
      };
      json.properties['skipTsConfig'] = {
        type: 'boolean',
        description: 'skip changes to tsconfig'
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
      expect(dryRunOutput).not.toContain('UPDATE tsconfig.json');

      const output = runCommand(
        `npm run workspace-schematic ${custom} ${workspace} -- --no-interactive --directory=dir`
      );
      checkFilesExist(`libs/dir/${workspace}/src/index.ts`);
      expect(output).toContain(`UPDATE ${workspaceConfigName()}`);
      expect(output).toContain('UPDATE nx.json');

      const another = uniq('another');
      runCLI(`g workspace-schematic ${another} --no-interactive`);

      const listSchematicsOutput = runCommand(
        'npm run workspace-schematic -- --list-schematics'
      );
      expect(listSchematicsOutput).toContain(
        'nx workspace-schematic "--list-schematics"'
      );
      expect(listSchematicsOutput).toContain(custom);
      expect(listSchematicsOutput).toContain(another);

      const promptOutput = runCommand(
        `npm run workspace-schematic ${custom} mylib2 --dry-run`
      );
      expect(promptOutput).toContain('UPDATE nx.json');
    }, 1000000);

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
        console.log(runCommand(`npm run dep-graph -- --file=dep-graph.json`));

        expect(() => checkFilesExist('dep-graph.json')).not.toThrow();

        const jsonFileContents = readJson('dep-graph.json');

        expect(jsonFileContents.deps).toEqual({
          mylib2: [],
          myapp3: [],
          'myapp3-e2e': [
            {
              projectName: 'myapp3',
              type: 'implicit'
            }
          ],
          myapp2: [
            {
              projectName: 'mylib',
              type: 'es6Import'
            }
          ],
          'myapp2-e2e': [
            {
              projectName: 'myapp2',
              type: 'implicit'
            }
          ],
          mylib: [
            {
              projectName: 'mylib2',
              type: 'es6Import'
            }
          ],
          myapp: [
            {
              projectName: 'mylib',
              type: 'es6Import'
            },
            {
              projectName: 'mylib2',
              type: 'loadChildren'
            }
          ],
          'myapp-e2e': [
            {
              projectName: 'myapp',
              type: 'implicit'
            }
          ]
        });

        runCommand(
          `npm run affected:dep-graph -- --files="libs/mylib/src/index.ts" --file="dep-graph.json"`
        );

        expect(() => checkFilesExist('dep-graph.json')).not.toThrow();

        const jsonFileContents2 = readJson('dep-graph.json');

        expect(jsonFileContents2.criticalPath).toContain('myapp');
        expect(jsonFileContents2.criticalPath).toContain('myapp2');
        expect(jsonFileContents2.criticalPath).toContain('mylib');
        expect(jsonFileContents2.criticalPath).not.toContain('mylib2');
      }, 1000000);
    });
  });
});
