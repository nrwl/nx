import {
  cleanupProject,
  newProject,
  readJson,
  runCLI,
  runCLIAsync,
  uniq,
} from '@nx/e2e-utils';

describe('NgRx', () => {
  beforeAll(() => {
    newProject({ packages: ['@nx/angular'] });
  });
  afterAll(() => {
    cleanupProject();
  });

  it('should work', async () => {
    const myapp = uniq('myapp');
    runCLI(
      `generate @nx/angular:app ${myapp} --no-standalone --no-interactive`
    );

    // Generate root ngrx state management with a global feature state
    runCLI(
      `generate @nx/angular:ngrx-root-store ${myapp} --name=users --minimal=false --addDevTools`
    );
    const packageJson = readJson('package.json');
    expect(packageJson.dependencies['@ngrx/store']).toBeDefined();
    expect(packageJson.dependencies['@ngrx/effects']).toBeDefined();
    expect(packageJson.dependencies['@ngrx/router-store']).toBeDefined();
    expect(packageJson.devDependencies['@ngrx/store-devtools']).toBeDefined();

    const mylib = uniq('mylib');
    // Generate feature library and ngrx state within that library
    runCLI(`g @nx/angular:lib ${mylib} --prefix=fl --no-standalone`);
    runCLI(
      `generate @nx/angular:ngrx-feature-store flights --parent=${mylib}/src/lib/${mylib}-module.ts --facade`
    );

    expect(runCLI(`build ${myapp}`)).toMatch(/main-[a-zA-Z0-9]+\.js/);
    expect(
      (await runCLIAsync(`test ${myapp} --no-watch`)).combinedOutput
    ).toContain(`Successfully ran target test for project ${myapp}`);
    expect(
      (await runCLIAsync(`test ${mylib} --no-watch`)).combinedOutput
    ).toContain(`Successfully ran target test for project ${mylib}`);
  }, 1000000);

  it('should work with barrels', async () => {
    const myapp = uniq('myapp');
    runCLI(
      `generate @nx/angular:app ${myapp} --routing --no-standalone --no-interactive`
    );

    // Generate root ngrx state management
    runCLI(`generate @nx/angular:ngrx-root-store ${myapp} --addDevTools`);
    const packageJson = readJson('package.json');
    expect(packageJson.dependencies['@ngrx/entity']).toBeDefined();
    expect(packageJson.dependencies['@ngrx/store']).toBeDefined();
    expect(packageJson.dependencies['@ngrx/effects']).toBeDefined();
    expect(packageJson.dependencies['@ngrx/router-store']).toBeDefined();
    expect(packageJson.devDependencies['@ngrx/schematics']).toBeDefined();
    expect(packageJson.devDependencies['@ngrx/store-devtools']).toBeDefined();

    const mylib = uniq('mylib');
    // Generate feature library and ngrx state within that library, using barrels
    runCLI(`g @nx/angular:lib ${mylib} --prefix=fl --no-standalone`);
    runCLI(
      `generate @nx/angular:ngrx-feature-store flights --parent=${mylib}/src/lib/${mylib}-module.ts --facade --barrels`
    );

    expect(runCLI(`build ${myapp}`)).toMatch(/main-[a-zA-Z0-9]+\.js/);
    expect(
      (await runCLIAsync(`test ${myapp} --no-watch`)).combinedOutput
    ).toContain(`Successfully ran target test for project ${myapp}`);
    expect(
      (await runCLIAsync(`test ${mylib} --no-watch`)).combinedOutput
    ).toContain(`Successfully ran target test for project ${mylib}`);
  }, 1000000);
});
