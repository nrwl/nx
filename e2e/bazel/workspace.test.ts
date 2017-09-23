import {checkFilesExist, cleanup, copyMissingPackages, ngNew, ngNewBazel, readFile, runCLI, runCommand, runSchematic, updateFile} from '../utils';

describe('workspace', () => {
  beforeEach(cleanup);

  it('creates a new workspace for developing angular applications', () => {
    ngNewBazel('--collection=@nrwl/bazel --skip-install');
    checkFilesExist(`tsconfig.json`, `WORKSPACE`, `BUILD.bazel`);
  });
});
