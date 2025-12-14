import {
  checkFilesExist,
  cleanupProject,
  newProject,
  runCLI,
  uniq,
  updateFile,
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
