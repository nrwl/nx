import {
  checkFilesExist,
  cleanupProject,
  newProject,
  runCLI,
  uniq,
  updateFile,
} from '@nx/e2e-utils';
import { createMavenProject } from './utils/create-maven-project';

describe('Maven 3.9.11 Batch Mode', () => {
  const projectName = uniq('batch-v3-test');

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

    // Update Maven wrapper to use Maven 3.9.11
    updateFile(
      '.mvn/wrapper/maven-wrapper.properties',
      `distributionUrl=https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.11/apache-maven-3.9.11-bin.zip
wrapperUrl=https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.3.2/maven-wrapper-3.3.2.jar
`
    );

    runCLI(`add @nx/maven`);
  });

  afterAll(() => cleanupProject());

  it('should build and install multiple projects with run-many in batch mode using Maven 3.9.11', () => {
    // Run install to build, test, and install all JARs to local repo
    runBatchCLI('run-many -t install');
    checkFilesExist(
      'app/target/app-1.0.0-SNAPSHOT.jar',
      'lib/target/lib-1.0.0-SNAPSHOT.jar',
      'utils/target/utils-1.0.0-SNAPSHOT.jar'
    );
  });

  it('should fail when unit test fails', () => {
    // Add a simple failing unit test (not Spring Boot test - just JUnit)
    updateFile(
      'app/src/test/java/com/example/app/SimpleTest.java',
      `package com.example.app;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.fail;

class SimpleTest {
    @Test
    void thisTestShouldFail() {
        fail("This test is intentionally failing");
    }
}`
    );

    // Run test on app project - this will include lifecycle dependencies
    // but the test should still fail with the right error message
    let error: any;
    try {
      runBatchCLI('run-many -t test -p com.example:app');
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.stdout || error.stderr).toContain('thisTestShouldFail');
  });
});
