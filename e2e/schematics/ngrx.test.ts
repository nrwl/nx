import {
  runCLI,
  expectTestsPass,
  runCLIAsync,
  uniq,
  ensureProject,
  readJson
} from '../utils';

describe('ngrx', () => {
  it('should work', async () => {
    ensureProject();

    const myapp = uniq('myapp');
    runCLI(`generate @nrwl/angular:app ${myapp} --no-interactive`);

    // Generate root ngrx state management
    runCLI(
      `generate @nrwl/angular:ngrx users --module=apps/${myapp}/src/app/app.module.ts --root`
    );
    const packageJson = readJson('package.json');
    expect(packageJson.dependencies['@ngrx/store']).toBeDefined();
    expect(packageJson.dependencies['@ngrx/effects']).toBeDefined();
    expect(packageJson.dependencies['@ngrx/router-store']).toBeDefined();
    expect(packageJson.devDependencies['@ngrx/store-devtools']).toBeDefined();

    const mylib = uniq('mylib');
    // Generate feature library and ngrx state within that library
    runCLI(`g @nrwl/angular:lib ${mylib} --prefix=fl`);
    runCLI(
      `generate @nrwl/angular:ngrx flights --module=libs/${mylib}/src/lib/${mylib}.module.ts --facade`
    );

    expect(runCLI(`build ${myapp}`)).toContain('chunk {main} main.js,');
    expectTestsPass(await runCLIAsync(`test ${myapp} --no-watch`));
    expectTestsPass(await runCLIAsync(`test ${mylib} --no-watch`));
  }, 1000000);
});
