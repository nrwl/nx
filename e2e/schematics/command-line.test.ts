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
  exists
} from '../utils';

describe('Command line', () => {
  it(
    'lint should ensure module boundaries',
    () => {
      newProject();
      newApp('myapp --tags=validtag');
      newApp('myapp2');
      newLib('mylib');
      newLib('lazylib');
      newLib('invalidtaglib --tags=invalidtag');
      newLib('validtaglib --tags=validtag');

      const tslint = readJson('tslint.json');
      tslint.rules['nx-enforce-module-boundaries'][1].depConstraints = [
        { sourceTag: 'validtag', onlyDependOnLibsWithTags: ['validtag'] },
        ...tslint.rules['nx-enforce-module-boundaries'][1].depConstraints
      ];
      updateFile('tslint.json', JSON.stringify(tslint, null, 2));

      updateFile(
        'apps/myapp/src/main.ts',
        `
      import '../../../libs/mylib';
      import '@proj/lazylib';
      import '@proj/mylib/deep';
      import '@proj/myapp2';
      import '@proj/invalidtaglib';
      import '@proj/validtaglib';

      const s = {loadChildren: '@proj/lazylib'};
    `
      );

      const out = runCLI('lint', { silenceError: true });
      expect(out).toContain('library imports must start with @proj/');
      expect(out).toContain('imports of lazy-loaded libraries are forbidden');
      expect(out).toContain('deep imports into libraries are forbidden');
      expect(out).toContain('imports of apps are forbidden');
      expect(out).toContain(
        'A project tagged with "validtag" can only depend on libs tagged with "validtag"'
      );
    },
    1000000
  );

  it('should run nx lint', () => {
    newProject();
    newApp('myapp');
    newApp('app_before');
    runCommand('mv apps/app-before apps/app-after');

    const stdout = runCommand('npm run lint');

    expect(stdout).toContain(
      `Cannot find project 'app-before' in 'apps/app-before/'`
    );
    expect(stdout).toContain(
      `The 'apps/app-after/browserslist' file doesn't belong to any project.`
    );
  });

  it('update should print deprecation information', () => {
    newProject();
    const update = runCommand('./node_modules/.bin/nx update');
    expect(update).toContain('Nx update is now deprecated.');
    expect(update).toContain(
      'Please use "ng update @nrwl/schematics" instead.'
    );
  });

  it(
    'affected should print, build, and test affected apps and libraries',
    () => {
      newProject();
      newApp('myapp');
      newApp('myapp2');
      newLib('mylib');
      newLib('mylib2');
      newLib('mypublishablelib --publishable');

      updateFile(
        'apps/myapp/src/app/app.component.spec.ts',
        `
          import '@proj/mylib';
          describe('sample test', () => {
            it('should test', () => {
              expect(1).toEqual(1);
            });
          });
        `
      );
      updateFile(
        'libs/mypublishablelib/src/lib/mypublishablelib.module.spec.ts',
        `
          import '@proj/mylib';
          describe('sample test', () => {
            it('should test', () => {
              expect(1).toEqual(1);
            });
          });
        `
      )

      const affectedApps = runCommand(
        'npm run affected:apps -- --files="libs/mylib/src/index.ts"'
      );
      expect(affectedApps).toContain('myapp');
      expect(affectedApps).not.toContain('myapp2');
      expect(affectedApps).not.toContain('myapp-e2e');

      const implicitlyAffectedApps = runCommand(
        'npm run affected:apps -- --files="package.json"'
      );
      expect(implicitlyAffectedApps).toContain('myapp');
      expect(implicitlyAffectedApps).toContain('myapp2');

      const noAffectedApps = runCommand(
        'npm run affected:apps -- --files="README.md"'
      );
      expect(noAffectedApps).not.toContain('myapp');
      expect(noAffectedApps).not.toContain('myapp2');

      const affectedLibs = runCommand(
        'npm run affected:libs -- --files="libs/mylib/src/index.ts"'
      );
      expect(affectedLibs).toContain('mypublishablelib');
      expect(affectedLibs).toContain('mylib');
      expect(affectedLibs).not.toContain('mylib2');

      const implicitlyAffectedLibs = runCommand(
        'npm run affected:libs -- --files="package.json"'
      );
      expect(implicitlyAffectedLibs).toContain('mypublishablelib');
      expect(implicitlyAffectedLibs).toContain('mylib');
      expect(implicitlyAffectedLibs).toContain('mylib2');

      const noAffectedLibs = runCommand(
        'npm run affected:libs -- --files="README.md"'
      );
      expect(noAffectedLibs).not.toContain('mypublishablelib');
      expect(noAffectedLibs).not.toContain('mylib');
      expect(noAffectedLibs).not.toContain('mylib2');

      const build = runCommand(
        'npm run affected:build -- --files="libs/mylib/src/index.ts"'
      );
      expect(build).toContain('Building mypublishablelib, myapp');
      expect(build).not.toContain('is not registered with the build command');
      expect(build).not.toContain('with flags:');

      // Should work in parallel
      const buildParallel = runCommand(
        'npm run affected:build -- --files="libs/mylib/src/index.ts" --parallel'
      );
      expect(buildParallel).toContain('Building mypublishablelib, myapp');

      const buildExcluded = runCommand(
        'npm run affected:build -- --files="libs/mylib/src/index.ts" --exclude myapp'
      );
      expect(buildExcluded).toContain('Building mypublishablelib');

      const buildExcludedCsv = runCommand(
        'npm run affected:build -- --files="package.json" --exclude myapp,myapp2,mypublishablelib'
      );
      expect(buildExcludedCsv).toContain('No projects to build');

      // affected:build should pass non-nx flags to the CLI
      const buildWithFlags = runCommand(
        'npm run affected:build -- --files="libs/mylib/src/index.ts" --stats-json'
      );
      expect(buildWithFlags).toContain(
        'Building mypublishablelib, myapp with flags: --stats-json=true'
      );

      const e2e = runCommand(
        'npm run affected:e2e -- --files="libs/mylib/src/index.ts"'
      );
      expect(e2e).toContain('should display welcome message');

      const unitTests = runCommand(
        'npm run affected:test -- --files="libs/mylib/src/index.ts"'
      );
      expect(unitTests).toContain('Testing mylib, mypublishablelib, myapp');

      // Fail a Unit Test
      updateFile(
        'apps/myapp/src/app/app.component.spec.ts',
        readFile('apps/myapp/src/app/app.component.spec.ts').replace(
          '.toEqual(1)',
          '.toEqual(2)'
        )
      );

      const failedTests = runCommand(
        'npm run affected:test -- --files="libs/mylib/src/index.ts"'
      );

      expect(failedTests).toContain('Testing mylib, mypublishablelib, myapp');
      expect(failedTests).toContain('Failed projects: myapp');
      expect(failedTests).toContain(
        'You can isolate the above projects by passing --only-failed'
      );
      expect(readJson('dist/.nx-results')).toEqual({
        command: 'test',
        results: {
          myapp: false,
          mylib: true,
          mypublishablelib: true
        }
      });

      // Fix failing Unit Test
      updateFile(
        'apps/myapp/src/app/app.component.spec.ts',
        readFile('apps/myapp/src/app/app.component.spec.ts').replace(
          '.toEqual(2)',
          '.toEqual(1)'
        )
      );

      const isolatedTests = runCommand(
        'npm run affected:test -- --files="libs/mylib/src/index.ts" --only-failed'
      );
      expect(isolatedTests).toContain('Testing myapp');

      const linting = runCommand(
        'npm run affected:lint -- --files="libs/mylib/src/index.ts"'
      );
      expect(linting).toContain('Linting mylib, myapp, myapp-e2e, mypublishablelib');

      const unitTestsExcluded = runCommand(
        'npm run affected:test -- --files="libs/mylib/src/index.ts" --exclude=myapp,mypublishablelib'
      );
      expect(unitTestsExcluded).toContain('Testing mylib');
    },
    1000000
  );

  it(
    'format should check and reformat the code',
    () => {
      newProject();
      newApp('myapp');
      newLib('mylib');
      updateFile(
        'apps/myapp/src/main.ts',
        `
         const x = 1111;
    `
      );

      updateFile(
        'apps/myapp/src/app/app.module.ts',
        `
         const y = 1111;
    `
      );

      updateFile(
        'apps/myapp/src/app/app.component.ts',
        `
         const z = 1111;
    `
      );

      updateFile(
        'libs/mylib/index.ts',
        `
         const x = 1111;
    `
      );
      updateFile(
        'libs/mylib/src/mylib.module.ts',
        `
         const y = 1111;
    `
      );

      let stdout = runCommand(
        'npm run -s format:check -- --files="libs/mylib/index.ts" --libs-and-apps'
      );
      expect(stdout).toContain('libs/mylib/index.ts');
      expect(stdout).toContain('libs/mylib/src/mylib.module.ts');

      stdout = runCommand('npm run -s format:check');
      expect(stdout).toContain('apps/myapp/src/main.ts');
      expect(stdout).toContain('apps/myapp/src/app/app.module.ts');
      expect(stdout).toContain('apps/myapp/src/app/app.component.ts');

      runCommand(
        'npm run format:write -- --files="apps/myapp/src/app/app.module.ts,apps/myapp/src/app/app.component.ts"'
      );

      stdout = runCommand('npm run -s format:check');

      expect(stdout).toContain('apps/myapp/src/main.ts');
      expect(stdout).not.toContain('apps/myapp/src/app/app.module.ts');
      expect(stdout).not.toContain('apps/myapp/src/app/app.component.ts');

      runCommand('npm run format:write');
      expect(runCommand('npm run -s format:check')).toEqual('');
    },
    1000000
  );

  it(
    'affected should print, build, and test all apps and publishable libraries',
    () => {
      newProject();
      newApp('myapp');
      newApp('myapp2');
      newLib('mylib');
      newLib('mypublishablelib --publishable')

      const affectedApps = runCommand('npm run affected:apps -- --all');
      expect(affectedApps).toContain('myapp');
      expect(affectedApps).toContain('myapp2');
      expect(affectedApps).not.toContain('myapp-e2e');

      const build = runCommand('npm run affected:build -- --all');
      expect(build).toContain('Building myapp');
      expect(build).toContain('Building myapp2');
      expect(build).toContain('Building mypublishablelib');
      expect(build).not.toContain('is not registered with the build command');

      const buildExcluded = runCommand(
        'npm run affected:build -- --files="libs/mylib/src/index.ts" --exclude myapp,myapp2,mypublishablelib'
      );
      expect(buildExcluded).toContain('No projects to build');

      const e2e = runCommand('npm run affected:e2e -- --all');
      expect(e2e).toContain('Testing myapp-e2e, myapp2-e2e');

      const unitTests = runCommand('npm run affected:test -- --all');
      expect(unitTests).toContain('Testing mypublishablelib, myapp2, myapp, mylib');
    },
    1000000
  );

  it(
    'should support workspace-specific schematics',
    () => {
      newProject();
      runCLI('g workspace-schematic custom');
      checkFilesExist(
        'tools/schematics/custom/index.ts',
        'tools/schematics/custom/schema.json'
      );

      const json = readJson('tools/schematics/custom/schema.json');
      json.properties['directory'] = {
        type: 'string',
        description: 'lib directory'
      };
      updateFile('tools/schematics/custom/schema.json', JSON.stringify(json));

      const indexFile = readFile('tools/schematics/custom/index.ts');
      updateFile(
        'tools/schematics/custom/index.ts',
        indexFile.replace(
          'name: schema.name',
          'name: schema.name, directory: schema.directory'
        )
      );

      const output = runCommand(
        'npm run workspace-schematic -- custom mylib --directory=dir'
      );
      checkFilesExist('libs/dir/mylib/src/index.ts');
      expect(output).toContain(
        'create libs/dir/mylib/src/lib/dir-mylib.module.ts'
      );
      expect(output).toContain('update angular.json');
      expect(output).toContain('update nx.json');
    },
    1000000
  );
  describe('dep-graph', () => {
    beforeEach(() => {
      newProject();
      newApp('myapp');
      newApp('myapp2');
      newApp('myapp3');
      newLib('mylib');
      newLib('mylib2');

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

    it(
      'dep-graph should output json (without critical path) to file',
      () => {
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
      },
      1000000
    );

    it(
      'dep-graph should output json with critical path to file',
      () => {
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
      },
      1000000
    );

    it(
      'dep-graph should output dot to file',
      () => {
        const file = 'dep-graph.dot';

        runCommand(
          `npm run dep-graph -- --files="libs/mylib/index.ts" --file="${file}"`
        );

        expect(() => checkFilesExist(file)).not.toThrow();

        const fileContents = readFile(file);
        expect(fileContents).toContain('"myapp" -> "mylib"');
        expect(fileContents).toContain('"myapp2" -> "mylib"');
        expect(fileContents).toContain('"mylib" -> "mylib2"');
      },
      1000000
    );

    it(
      'dep-graph should output html to file',
      () => {
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
      },
      1000000
    );
  });
});
