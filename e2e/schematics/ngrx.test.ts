import {checkFilesExists, cleanup, copyMissingPackages, newApp, readFile, runCLI} from '../utils';

describe('ngrx', () => {
  beforeEach(cleanup);

  describe('root', () => {
    it('should generate', () => {
      newApp('--skip-install');
      runCLI('generate ngrx app --module=src/app/app.module.ts --root --collection=@nrwl/schematics');

      checkFilesExists(
          `src/app/+state/app.actions.ts`, `src/app/+state/app.effects.ts`, `src/app/+state/app.effects.spec.ts`,
          `src/app/+state/app.init.ts`, `src/app/+state/app.interfaces.ts`, `src/app/+state/app.reducer.ts`,
          `src/app/+state/app.reducer.spec.ts`);

      const contents = readFile('src/app/app.module.ts');
      expect(contents).toContain('StoreModule.forRoot');
      expect(contents).toContain('EffectsModule.forRoot');
    });

    it('should build', () => {
      newApp();
      copyMissingPackages();
      runCLI('generate ngrx app --module=src/app/app.module.ts --root --collection=@nrwl/schematics');

      runCLI('build');
      runCLI('test --single-run');
    }, 50000);

    it('should add empty root configuration', () => {
      newApp();
      copyMissingPackages();
      runCLI('generate ngrx app --module=src/app/app.module.ts --onlyEmptyRoot --collection=@nrwl/schematics');

      const contents = readFile('src/app/app.module.ts');
      expect(contents).toContain('StoreModule.forRoot');
      expect(contents).toContain('EffectsModule.forRoot');

      runCLI('build');
    }, 50000);
  });

  describe('feature', () => {
    it('should generate', () => {
      newApp('--skip-install');
      runCLI('generate ngrx app --module=src/app/app.module.ts --collection=@nrwl/schematics');

      checkFilesExists(
          `src/app/+state/app.actions.ts`, `src/app/+state/app.effects.ts`, `src/app/+state/app.effects.spec.ts`,
          `src/app/+state/app.init.ts`, `src/app/+state/app.interfaces.ts`, `src/app/+state/app.reducer.ts`,
          `src/app/+state/app.reducer.spec.ts`);

      const contents = readFile('src/app/app.module.ts');
      expect(contents).toContain('StoreModule.forFeature');
      expect(contents).toContain('EffectsModule.forFeature');
    });
  });

  it('should generate files without importing them', () => {
    newApp('--skip-install');
    runCLI('generate ngrx app --module=src/app/app.module.ts --onlyAddFiles --collection=@nrwl/schematics');

    checkFilesExists(
        `src/app/+state/app.actions.ts`, `src/app/+state/app.effects.ts`, `src/app/+state/app.effects.spec.ts`,
        `src/app/+state/app.init.ts`, `src/app/+state/app.interfaces.ts`, `src/app/+state/app.reducer.ts`,
        `src/app/+state/app.reducer.spec.ts`);

    const contents = readFile('src/app/app.module.ts');
    expect(contents).not.toContain('StoreModule');
    expect(contents).not.toContain('EffectsModule');
  });

  it('should update package.json', () => {
    newApp('--skip-install');
    runCLI('generate ngrx app --module=src/app/app.module.ts --collection=@nrwl/schematics');

    const contents = JSON.parse(readFile('package.json'));

    expect(contents.dependencies['@ngrx/store']).toBeDefined();
    expect(contents.dependencies['@ngrx/router-store']).toBeDefined();
    expect(contents.dependencies['@ngrx/effects']).toBeDefined();
  });
});
