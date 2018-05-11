import { newApp, newProject, runCLI } from '../utils';

describe('ngrx', () => {
  it(
    'should work',
    () => {
      newProject();
      newApp('myapp');

      // Generate root ngrx state management
      runCLI(
        'generate ngrx users --module=apps/myapp/src/app/app.module.ts --root --collection=@nrwl/schematics'
      );

      // Generate feature library and ngrx state within that library
      runCLI('g @nrwl/schematics:lib feature-flights --prefix=fl');
      runCLI(
        'generate ngrx flights --module=libs/feature-flights/src/lib/feature-flights.module.ts --collection=@nrwl/schematics'
      );

      expect(runCLI('build')).toContain('chunk {main} main.js,');
      expect(runCLI('test myapp --no-watch')).toContain(
        'Executed 10 of 10 SUCCESS'
      );
      expect(runCLI('test feature-flights --no-watch')).toContain(
        'Executed 8 of 8 SUCCESS'
      );
    },
    1000000
  );
});
