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
    // runCLI throws on non-zero exit, so successful execution + file checks is sufficient
    runBatchCLI('run-many -t verify');
    checkFilesExist(
      'app/target/app-1.0.0-SNAPSHOT.jar',
      'lib/target/lib-1.0.0-SNAPSHOT.jar',
      'utils/target/utils-1.0.0-SNAPSHOT.jar'
    );
  });

  it('should fail when unit test fails', () => {
    // Add a failing unit test
    updateFile(
      'app/src/test/java/com/example/app/AppApplicationTests.java',
      `package com.example.app;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import static org.junit.jupiter.api.Assertions.fail;

@SpringBootTest
class AppApplicationTests {
    @Test
    void contextLoads() {
    }

    @Test
    void thisTestShouldFail() {
        fail("This test is intentionally failing");
    }
}`
    );

    // Expect the command to throw due to test failure and verify error is printed
    let error: any;
    try {
      runBatchCLI('run-many -t verify');
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.stdout || error.stderr).toContain('thisTestShouldFail');
  });
});
