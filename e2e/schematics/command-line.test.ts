import {
  checkFilesExist,
  newApp,
  newLib,
  newProject,
  readFile,
  readJson,
  runCLI,
  runCommand,
  updateFile,
  exists,
  ensureProject,
  uniq
} from '../utils';

describe('Command line', () => {
  it('lint should ensure module boundaries', () => {
    ensureProject();

    const myapp = uniq('myapp');
    const myapp2 = uniq('myapp2');
    const mylib = uniq('mylib');
    const lazylib = uniq('lazylib');
    const invalidtaglib = uniq('invalidtaglib');
    const validtaglib = uniq('validtaglib');

    newApp(`${myapp} --tags=validtag`);
    newApp(`${myapp2} --framework=angular`);
    newLib(`${mylib} --framework=angular`);
    newLib(`${lazylib} --framework=angular`);
    newLib(`${invalidtaglib} --tags=invalidtag --framework=angular`);
    newLib(`${validtaglib} --tags=validtag --framework=angular`);

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

      newApp(appBefore);
      runCommand(`mv apps/${appBefore} apps/${appAfter}`);

      const stdout = runCommand('./node_modules/.bin/nx lint');
      expect(stdout).toContain(
        `Cannot find project '${appBefore}' in 'apps/${appBefore}/'`
      );
      expect(stdout).toContain(
        `The 'apps/${appAfter}/browserslist' file doesn't belong to any project.`
      );
    });
  });

  it('format should check and reformat the code', () => {
    ensureProject();
    const myapp = uniq('myapp');
    const mylib = uniq('mylib');

    newApp(myapp);
    newLib(`${mylib} --framework=angular`);
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

    stdout = runCommand(`npm run -s format:check`);
    expect(stdout).toContain(`apps/${myapp}/src/main.ts`);
    expect(stdout).toContain(`apps/${myapp}/src/app/app.module.ts`);
    expect(stdout).toContain(`apps/${myapp}/src/app/app.component.ts`);

    runCommand(
      `npm run format:write -- --files="apps/${myapp}/src/app/app.module.ts,apps/${myapp}/src/app/app.component.ts"`
    );

    stdout = runCommand('npm run -s format:check');

    expect(stdout).toContain(`apps/${myapp}/src/main.ts`);
    expect(stdout).not.toContain(`apps/${myapp}/src/app/app.module.ts`);
    expect(stdout).not.toContain(`apps/${myapp}/src/app/app.component.ts`);

    runCommand('npm run format:write');
    expect(runCommand('npm run -s format:check')).toEqual('');
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
    updateFile(`tools/schematics/${custom}/schema.json`, JSON.stringify(json));

    const indexFile = readFile(`tools/schematics/${custom}/index.ts`);
    updateFile(
      `tools/schematics/${custom}/index.ts`,
      indexFile.replace(
        'name: schema.name',
        'name: schema.name, directory: schema.directory'
      )
    );

    const workspace = uniq('workspace');
    const dryRunOutput = runCommand(
      `npm run workspace-schematic ${custom} ${workspace} -- --no-interactive --directory=dir -d`
    );
    expect(exists(`libs/dir/${workspace}/src/index.ts`)).toEqual(false);
    expect(dryRunOutput).toContain('update angular.json');
    expect(dryRunOutput).toContain('update nx.json');

    const output = runCommand(
      `npm run workspace-schematic ${custom} ${workspace} -- --no-interactive --directory=dir`
    );
    checkFilesExist(`libs/dir/${workspace}/src/index.ts`);
    expect(output).toContain('update angular.json');
    expect(output).toContain('update nx.json');

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
      `npm run workspace-schematic ${custom} mylib2 --`
    );
    expect(promptOutput).toContain(
      'In which directory should the library be generated?'
    );
  }, 1000000);

  describe('dep-graph', () => {
    beforeAll(() => {
      newProject();
      newApp('myapp');
      newApp('myapp2');
      newApp('myapp3');
      newLib('mylib --framework=angular');
      newLib('mylib2 --framework=angular');

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

    it('dep-graph should output json (without critical path) to file', () => {
      const file = 'dep-graph.json';

      runCommand(`npm run dep-graph -- --file="${file}"`);

      expect(() => checkFilesExist(file)).not.toThrow();

      const jsonFileContents = readJson(file);

      expect(jsonFileContents).toEqual({
        deps: {
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
        },
        criticalPath: []
      });
    }, 1000000);

    it('dep-graph should output json with critical path to file', () => {
      const file = 'dep-graph.json';

      runCommand(
        `npm run affected:dep-graph -- --files="libs/mylib/src/index.ts" --file="${file}"`
      );

      expect(() => checkFilesExist(file)).not.toThrow();

      const jsonFileContents = readJson(file);

      expect(jsonFileContents.criticalPath).toContain('myapp');
      expect(jsonFileContents.criticalPath).toContain('myapp2');
      expect(jsonFileContents.criticalPath).toContain('mylib');
      expect(jsonFileContents.criticalPath).not.toContain('mylib2');
    }, 1000000);

    it('dep-graph should output dot to file', () => {
      const file = 'dep-graph.dot';

      runCommand(
        `npm run dep-graph -- --files="libs/mylib/index.ts" --file="${file}"`
      );

      expect(() => checkFilesExist(file)).not.toThrow();

      const fileContents = readFile(file);
      expect(fileContents).toContain('"myapp" -> "mylib"');
      expect(fileContents).toContain('"myapp2" -> "mylib"');
      expect(fileContents).toContain('"mylib" -> "mylib2"');
    }, 1000000);

    it('dep-graph should output html to file', () => {
      const file = 'dep-graph.html';
      runCommand(
        `npm run dep-graph -- --files="libs/mylib/index.ts" --file="${file}"`
      );

      expect(() => checkFilesExist(file)).not.toThrow();

      const fileContents = readFile(file);
      expect(fileContents).toContain('<html>');
      expect(fileContents).toContain('<title>myapp&#45;&gt;mylib</title>');
      expect(fileContents).toContain('<title>myapp&#45;&gt;mylib2</title>');
      expect(fileContents).toContain('<title>mylib&#45;&gt;mylib2</title>');
    }, 1000000);
  });
});
