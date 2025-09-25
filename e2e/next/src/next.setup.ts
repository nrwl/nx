import {
  checkFilesDoNotExist,
  checkFilesExist,
  cleanupProject,
  getStrippedEnvironmentVariables,
  newProject,
  readFile,
  runCLI,
  runE2ETests,
  uniq,
  updateFile,
} from '@nx/e2e-utils';

export function setupNextSuite() {
  let proj: string;
  let originalEnv: string;

  beforeAll(() => {
    proj = newProject({
      packages: ['@nx/next', '@nx/cypress'],
    });
  });

  beforeEach(() => {
    originalEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  afterAll(() => cleanupProject());

  return () => proj;
}

