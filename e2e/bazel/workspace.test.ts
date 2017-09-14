import {checkFilesExists, cleanup, copyMissingPackages, newApp, readFile, runCLI, runCommand, runSchematic, updateFile} from '../utils';

describe('workspace', () => {
  beforeEach(cleanup);

  it('creates a new workspace for developing angular applications', () => {
    runSchematic('@nrwl/bazel:application --name=proj --version=0.1');

    checkFilesExists(`tsconfig.json`, `WORKSPACE`, `BUILD.bazel`);
  });
});
