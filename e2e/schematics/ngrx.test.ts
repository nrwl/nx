import {checkFilesExists, cleanup, copyMissingPackages, newApp, readFile, runCLI, runCommand, runSchematic, updateFile} from '../utils';

describe('ngrx', () => {
  beforeEach(cleanup);

  describe('root', () => {
    it('should generate', () => {
      newApp('--skip-import');

      runSchematic('@nrwl/schematics:ngrx --module=src/app/app.module.ts --root');

      checkFilesExists(
          `src/app/+state/app.actions.ts`, `src/app/+state/app.effects.ts`,
          `src/app/+state/app.effects.spec.ts`, `src/app/+state/app.init.ts`,
          `src/app/+state/app.interfaces.ts`, `src/app/+state/app.reducer.ts`,
          `src/app/+state/app.reducer.spec.ts`);

      const contents = readFile('src/app/app.module.ts');
      expect(contents).toContain('StoreModule.forRoot');
      expect(contents).toContain('EffectsModule.forRoot');
    });
    //
    it('should build', () => {
      newApp();
      copyMissingPackages();

      runSchematic('@nrwl/schematics:ngrx --module=src/app/app.module.ts --root');

      runCLI('build');
      runCLI('test --single-run');
    }, 50000);

    it('should add empty root configuration', () => {
      newApp();
      copyMissingPackages();

      runSchematic('@nrwl/schematics:ngrx --module=src/app/app.module.ts --onlyEmptyRoot');

      const contents = readFile('src/app/app.module.ts');
      expect(contents).toContain('StoreModule.forRoot');
      expect(contents).toContain('EffectsModule.forRoot');

      runCLI('build');
    }, 50000);
  });

  describe('feature', () => {
    it('should generate', () => {
      newApp('--skipInstall');
      runSchematic('@nrwl/schematics:ngrx --module=src/app/app.module.ts');

      checkFilesExists(
          `src/app/+state/app.actions.ts`, `src/app/+state/app.effects.ts`,
          `src/app/+state/app.effects.spec.ts`, `src/app/+state/app.init.ts`,
          `src/app/+state/app.interfaces.ts`, `src/app/+state/app.reducer.ts`,
          `src/app/+state/app.reducer.spec.ts`);

      const contents = readFile('src/app/app.module.ts');
      expect(contents).toContain('StoreModule.forFeature');
      expect(contents).toContain('EffectsModule.forFeature');
    });
  });

  it('should generate files without importing them', () => {
    newApp('--skipInstall');
    runSchematic('@nrwl/schematics:ngrx --module=src/app/app.module.ts --onlyAddFiles');

    checkFilesExists(
        `src/app/+state/app.actions.ts`, `src/app/+state/app.effects.ts`,
        `src/app/+state/app.effects.spec.ts`, `src/app/+state/app.init.ts`,
        `src/app/+state/app.interfaces.ts`, `src/app/+state/app.reducer.ts`,
        `src/app/+state/app.reducer.spec.ts`);

    const contents = readFile('src/app/app.module.ts');
    expect(contents).not.toContain('StoreModule');
    expect(contents).not.toContain('EffectsModule');
  });

  it('should update package.json', () => {
    newApp('--skipInstall');
    runSchematic('@nrwl/schematics:ngrx --module=src/app/app.module.ts');

    const contents = JSON.parse(readFile('package.json'));

    expect(contents.dependencies['@ngrx/store']).toBeDefined();
    expect(contents.dependencies['@ngrx/router-store']).toBeDefined();
    expect(contents.dependencies['@ngrx/effects']).toBeDefined();
  });
});
