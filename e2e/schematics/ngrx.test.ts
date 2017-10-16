import { checkFilesExist, cleanup, copyMissingPackages, ngNew, readFile, runCLI } from '../utils';

describe('ngrx', () => {
  beforeEach(cleanup);

  it(
    'should work',
    () => {
      ngNew();
      copyMissingPackages();
      runCLI('generate ngrx app --module=src/app/app.module.ts --root --collection=@nrwl/schematics');

      runCLI('build');
      runCLI('test --single-run');
    },
    100000
  );
});
