import {
  checkFilesExist,
  cleanupProject,
  newProject,
  runCLI,
  uniq,
  updateFile,
} from '@nx/e2e-utils';
import { createMavenProject } from './utils/create-maven-project';

describe('Maven 4 Batch Mode', () => {
  const projectName = uniq('batch-v4-test');

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

    // Update Maven wrapper to use Maven 4.0.0-rc-4
    updateFile(
      '.mvn/wrapper/maven-wrapper.properties',
      `distributionUrl=https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/4.0.0-rc-4/apache-maven-4.0.0-rc-4-bin.zip
wrapperUrl=https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.3.2/maven-wrapper-3.3.2.jar
`
    );

    runCLI(`add @nx/maven`);
  });

  afterAll(() => cleanupProject());

  it('should build multiple projects with run-many in batch mode using Maven 4.0.0-rc-4', () => {
    const output = runBatchCLI('run-many -t verify', { verbose: true });
    expect(output).toContain('BUILD SUCCESS');
    checkFilesExist(
      'app/target/app-1.0.0-SNAPSHOT.jar',
      'lib/target/lib-1.0.0-SNAPSHOT.jar',
      'utils/target/utils-1.0.0-SNAPSHOT.jar'
    );
  });
});
