import {
  cleanupProject,
  expectTestsPass,
  getSelectedPackageManager,
  newProject,
  readJson,
  runCLI,
  runCLIAsync,
  uniq,
} from '@nx/e2e/utils';

describe('Angular Package', () => {
  describe('ngrx', () => {
    beforeAll(() => {
      newProject({ packages: ['@nx/angular'] });
    });
    afterAll(() => {
      cleanupProject();
    });

    it('should work', async () => {
      const myapp = uniq('myapp');
      runCLI(
        `generate @nx/angular:app ${myapp} --no-standalone --project-name-and-root-format=as-provided --no-interactive`
      );

      // Generate root ngrx state management
      runCLI(
        `generate @nx/angular:ngrx users --parent=${myapp}/src/app/app.module.ts --root --minimal=false`
      );
      const packageJson = readJson('package.json');
      expect(packageJson.dependencies['@ngrx/store']).toBeDefined();
      expect(packageJson.dependencies['@ngrx/effects']).toBeDefined();
      expect(packageJson.dependencies['@ngrx/router-store']).toBeDefined();
      expect(packageJson.devDependencies['@ngrx/store-devtools']).toBeDefined();

      const mylib = uniq('mylib');
      // Generate feature library and ngrx state within that library
      runCLI(
        `g @nx/angular:lib ${mylib} --prefix=fl --no-standalone --project-name-and-root-format=as-provided`
      );
      runCLI(
        `generate @nx/angular:ngrx flights --parent=${mylib}/src/lib/${mylib}.module.ts --facade`
      );

      expect(runCLI(`build ${myapp}`)).toMatch(/main-[a-zA-Z0-9]+\.js/);
      expectTestsPass(await runCLIAsync(`test ${myapp} --no-watch`));
      // TODO: remove this condition
      if (getSelectedPackageManager() !== 'pnpm') {
        expectTestsPass(await runCLIAsync(`test ${mylib} --no-watch`));
      }
    }, 1000000);

    it('should work with creators', async () => {
      const myapp = uniq('myapp');
      runCLI(
        `generate @nx/angular:app ${myapp} --routing --no-standalone --project-name-and-root-format=as-provided --no-interactive`
      );

      // Generate root ngrx state management
      runCLI(
        `generate @nx/angular:ngrx users --parent=${myapp}/src/app/app.module.ts --root`
      );
      const packageJson = readJson('package.json');
      expect(packageJson.dependencies['@ngrx/entity']).toBeDefined();
      expect(packageJson.dependencies['@ngrx/store']).toBeDefined();
      expect(packageJson.dependencies['@ngrx/effects']).toBeDefined();
      expect(packageJson.dependencies['@ngrx/router-store']).toBeDefined();
      expect(packageJson.devDependencies['@ngrx/schematics']).toBeDefined();
      expect(packageJson.devDependencies['@ngrx/store-devtools']).toBeDefined();

      const mylib = uniq('mylib');
      // Generate feature library and ngrx state within that library
      runCLI(
        `g @nx/angular:lib ${mylib} --prefix=fl --no-standalone --project-name-and-root-format=as-provided`
      );

      const flags = `--facade --barrels`;
      runCLI(
        `generate @nx/angular:ngrx flights --parent=${mylib}/src/lib/${mylib}.module.ts ${flags}`
      );

      expect(runCLI(`build ${myapp}`)).toMatch(/main-[a-zA-Z0-9]+\.js/);
      expectTestsPass(await runCLIAsync(`test ${myapp} --no-watch`));
      // TODO: remove this condition
      if (getSelectedPackageManager() !== 'pnpm') {
        expectTestsPass(await runCLIAsync(`test ${mylib} --no-watch`));
      }
    }, 1000000);

    it('should work with creators using --module', async () => {
      const myapp = uniq('myapp');
      runCLI(
        `generate @nx/angular:app ${myapp} --routing --no-standalone --project-name-and-root-format=as-provided --no-interactive`
      );

      // Generate root ngrx state management
      runCLI(
        `generate @nx/angular:ngrx users --parent=${myapp}/src/app/app.module.ts --root`
      );
      const packageJson = readJson('package.json');
      expect(packageJson.dependencies['@ngrx/entity']).toBeDefined();
      expect(packageJson.dependencies['@ngrx/store']).toBeDefined();
      expect(packageJson.dependencies['@ngrx/effects']).toBeDefined();
      expect(packageJson.dependencies['@ngrx/router-store']).toBeDefined();
      expect(packageJson.devDependencies['@ngrx/schematics']).toBeDefined();
      expect(packageJson.devDependencies['@ngrx/store-devtools']).toBeDefined();

      const mylib = uniq('mylib');
      // Generate feature library and ngrx state within that library
      runCLI(
        `g @nx/angular:lib ${mylib} --prefix=fl --no-standalone --project-name-and-root-format=as-provided`
      );

      const flags = `--facade --barrels`;
      runCLI(
        `generate @nx/angular:ngrx flights --module=${mylib}/src/lib/${mylib}.module.ts ${flags}`
      );

      expect(runCLI(`build ${myapp}`)).toMatch(/main-[a-zA-Z0-9]+\.js/);
      expectTestsPass(await runCLIAsync(`test ${myapp} --no-watch`));
      // TODO: remove this condition
      if (getSelectedPackageManager() !== 'pnpm') {
        expectTestsPass(await runCLIAsync(`test ${mylib} --no-watch`));
      }
    }, 1000000);
  });
});
