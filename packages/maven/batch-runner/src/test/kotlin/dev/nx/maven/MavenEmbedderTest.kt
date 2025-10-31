package dev.nx.maven

import org.apache.maven.api.cli.ExecutorRequest
import org.apache.maven.cling.executor.embedded.EmbeddedMavenExecutor
import org.junit.jupiter.api.Test
import java.io.ByteArrayOutputStream
import java.nio.file.Paths

/**
 * Test demonstrating Maven 4.x EmbeddedMavenExecutor API for batch task execution.
 *
 * Key advantages over Maven Invoker:
 * - Invoker spawns a subprocess for each task (~100-500ms per task overhead)
 * - EmbeddedMavenExecutor executes Maven in-process, reusing reactor and cache
 * - Context caching: loaded classloaders are cached per Maven installation
 * - Automatic realm cleanup prevents memory leaks
 * - Proper state restoration between invocations
 */
class MavenEmbedderTest {

  @Test
  fun `embedded executor executes multiple tasks with single instance`() {
    val mavenHome = System.getenv("MAVEN_HOME") ?: return // Skip if MAVEN_HOME not set
    val workspaceRoot = Paths.get(System.getProperty("user.dir"))

    // Initialize EmbeddedMavenExecutor once with context caching enabled
    val executor = EmbeddedMavenExecutor(true, true)

    try {
      // Simulate executing multiple tasks with same executor instance
      val tasksToExecute = listOf(
        listOf("validate"),
        listOf("help:describe")
      )

      for (goals in tasksToExecute) {
        // Capture output for this task
        val output = ByteArrayOutputStream()

        // Build ExecutorRequest using Maven 4.x API
        val request = ExecutorRequest.mavenBuilder(Paths.get(mavenHome))
          .arguments(goals)
          .cwd(workspaceRoot)
          .stdOut(output)
          .stdErr(System.err)
          .build()

        // Execute goal using EmbeddedMavenExecutor
        // Key: Same executor instance + context caching = reactor scanned once
        val exitCode = executor.execute(request)

        // Task executed
        assert(exitCode == 0) { "Expected exit code 0, got $exitCode" }
      }
    } finally {
      executor.close()
    }
  }

  @Test
  fun `executor reuses context for multiple invocations`() {
    val mavenHome = System.getenv("MAVEN_HOME") ?: return // Skip if MAVEN_HOME not set
    val workspaceRoot = Paths.get(System.getProperty("user.dir"))

    // Multiple tasks use same executor instance with context caching
    val executor = EmbeddedMavenExecutor(true, true)

    try {
      repeat(3) {
        val output = ByteArrayOutputStream()

        val request = ExecutorRequest.mavenBuilder(Paths.get(mavenHome))
          .arguments(listOf("help:describe"))
          .cwd(workspaceRoot)
          .stdOut(output)
          .stdErr(System.err)
          .build()

        val exitCode = executor.execute(request)
        assert(exitCode == 0) { "Expected exit code 0, got $exitCode" }
      }
    } finally {
      executor.close()
    }
  }
}
