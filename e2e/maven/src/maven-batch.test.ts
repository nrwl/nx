import {
  checkFilesExist,
  cleanupProject,
  newProject,
  runCLI,
  uniq,
} from '@nx/e2e-utils';
import { createMavenProject } from './utils/create-maven-project';

describe('Maven Batch Mode', () => {
  const projectName = uniq('batch-test');

  // Helper to run CLI with batch mode enabled
  const runBatchCLI = (cmd: string, opts: { verbose?: boolean } = {}) => {
    return runCLI(cmd, {
      ...opts,
      env: { NX_BATCH_MODE: 'true' },
    });
  };

  beforeAll(async () => {
    newProject({
      preset: 'apps',
      packages: ['@nx/maven'],
    });
    await createMavenProject(projectName);
    runCLI(`add @nx/maven`);
  });

  afterAll(() => cleanupProject());

  it('should build multiple projects with run-many in batch mode', () => {
    const output = runBatchCLI('run-many -t verify', { verbose: true });
    expect(output).toContain('BUILD SUCCESS');
    checkFilesExist(
      'app/target/app-1.0.0-SNAPSHOT.jar',
      'lib/target/lib-1.0.0-SNAPSHOT.jar',
      'utils/target/utils-1.0.0-SNAPSHOT.jar'
    );
  });
});
