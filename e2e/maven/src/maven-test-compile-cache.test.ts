import {
  checkFilesExist,
  cleanupProject,
  newProject,
  runCLI,
  uniq,
  updateFile,
} from '@nx/e2e-utils';
import { createMavenProject } from './utils/create-maven-project';

describe('Maven testCompile cache invalidation', () => {
  const projectName = uniq('test-compile-cache');

  beforeAll(async () => {
    newProject({
      preset: 'apps',
      packages: ['@nx/maven'],
    });
    await createMavenProject(projectName);
    runCLI(`add @nx/maven`);
  });

  afterAll(() => cleanupProject());

  it('should invalidate testCompile cache when test sources change', () => {
    // Step 1: Run verify to populate the cache (all tests pass)
    const firstRun = runCLI('run-many -t verify', { verbose: true });
    expect(firstRun).toContain('BUILD SUCCESS');
    checkFilesExist(
      'app/target/app-1.0.0-SNAPSHOT.jar',
      'lib/target/lib-1.0.0-SNAPSHOT.jar',
      'utils/target/utils-1.0.0-SNAPSHOT.jar'
    );

    // Step 2: Modify a test source file — add a failing test.
    // This should invalidate the testCompile cache for app because
    // src/test/java/**/*.java is an input to the testCompile task hash.
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

    // Step 3: Run verify again WITHOUT nx reset.
    // If testCompile correctly includes test sources in its hash,
    // the modified test file causes a cache miss, Maven recompiles,
    // and the failing test is detected.
    let error: any;
    try {
      runCLI('run-many -t verify');
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.stdout || error.stderr).toContain('thisTestShouldFail');
  });
});
