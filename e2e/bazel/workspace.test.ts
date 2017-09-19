import {checkFilesExists, cleanup, copyMissingPackages, newApp, newBazelApp, readFile, runCLI, runCommand, runSchematic, updateFile} from '../utils';

describe('workspace', () => {
  beforeEach(cleanup);

  it('creates a new workspace for developing angular applications', () => {
    newBazelApp('--collection=@nrwl/bazel --skip-install');
    checkFilesExists(`tsconfig.json`, `WORKSPACE`, `BUILD.bazel`);
  });
});
