import { newApp, newProject, runCLI, copyMissingPackages } from '../utils';

describe('ngrx', () => {
  it('should work', () => {
    newProject();
    newApp('myapp');

    // Generate root ngrx state management
    runCLI(
      'generate ngrx users --module=apps/myapp/src/app/app.module.ts --root'
    );
    copyMissingPackages();

    // Generate feature library and ngrx state within that library
    runCLI('g @nrwl/schematics:lib feature-flights --prefix=fl');
    runCLI(
      'generate ngrx flights --module=libs/feature-flights/src/lib/feature-flights.module.ts --facade'
    );

    expect(runCLI('lint', { silenceError: true })).not.toContain('ERROR');

    expect(runCLI('build')).toContain('chunk {main} main.js,');
    expect(runCLI('test myapp --no-watch')).toContain(
      'Executed 10 of 10 SUCCESS'
    );
    expect(runCLI('test feature-flights --no-watch')).toContain(
      'Executed 10 of 10 SUCCESS'
    );
  }, 1000000);
});
