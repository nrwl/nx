package dev.nx.maven

import org.apache.maven.api.cli.ExecutorRequest
import org.apache.maven.cling.executor.embedded.EmbeddedMavenExecutor
import org.junit.jupiter.api.Test
import java.io.ByteArrayOutputStream
import java.nio.file.Paths

/**
 * Demonstration of Maven 4.x EmbeddedMavenExecutor API for batch task execution.
 *
 * The EmbeddedMavenExecutor is designed for executing multiple Maven tasks efficiently:
 * - Context caching: ClassLoaders are cached per Maven installation, no reload overhead
 * - Single instance reused: Same executor handles multiple invocations
 * - Automatic cleanup: Runtime-created class realms disposed automatically
 * - State restoration: System properties and streams restored after each execution
 * - In-process execution: No subprocess spawning, direct Java method calls
 *
 * This is significantly more efficient than Maven Invoker which spawns a subprocess
 * per task (~100-500ms overhead per task).
 */
class MavenEmbedderTest {

  @Test
  fun `demonstrate embedded executor context caching across multiple invocations`() {
    val mavenHome = System.getenv("MAVEN_HOME") ?: run {
      println("MAVEN_HOME not set - test skipped")
      return
    }

    val workspaceRoot = Paths.get(System.getProperty("user.dir"))

    // Initialize EmbeddedMavenExecutor ONCE with context caching enabled (true, true)
    // This is the key to performance: the executor reuses loaded classloaders
    val executor = EmbeddedMavenExecutor(true, true)

    try {
      println("\n=== Demonstrating EmbeddedMavenExecutor Context Caching ===\n")

      // Execute the same goal 3 times using the SAME executor instance
      // With context caching enabled, the Maven classloader is loaded once and reused
      repeat(3) { iteration ->
        val output = ByteArrayOutputStream()

        println("Iteration ${iteration + 1}: Building ExecutorRequest...")

        // ExecutorRequest uses a fluent builder API
        val request = ExecutorRequest.mavenBuilder(Paths.get(mavenHome))
          .arguments(listOf("--version"))  // Simple goal that always succeeds
          .cwd(workspaceRoot)
          .stdOut(output)
          .stdErr(System.err)
          .build()

        println("Iteration ${iteration + 1}: Executing Maven goal...")
        val startTime = System.currentTimeMillis()

        // This reuses the cached context from previous iterations
        // First invocation loads classloader (~500ms), subsequent ones are ~10-50ms
        val exitCode = executor.execute(request)

        val duration = System.currentTimeMillis() - startTime
        println("Iteration ${iteration + 1}: Exit code=$exitCode, Duration=${duration}ms")
        println("Iteration ${iteration + 1}: Output: ${output.toString().take(100)}\n")

        assert(exitCode == 0) { "Maven execution failed with exit code $exitCode" }
      }

      println("=== All iterations completed successfully ===")
      println("Notice how subsequent invocations are faster due to context caching!\n")
    } finally {
      println("Closing EmbeddedMavenExecutor (cleaning up cached contexts and class realms)...")
      executor.close()
      println("Cleanup complete - all Maven classloaders and realms disposed.\n")
    }
  }

  @Test
  fun `show executor behavior when caching is disabled`() {
    val mavenHome = System.getenv("MAVEN_HOME") ?: run {
      println("MAVEN_HOME not set - test skipped")
      return
    }

    val workspaceRoot = Paths.get(System.getProperty("user.dir"))

    // Initialize EmbeddedMavenExecutor with caching DISABLED (false, true)
    // This is useful for comparison: shows the difference caching makes
    val executor = EmbeddedMavenExecutor(false, true)

    try {
      println("\n=== Demonstrating without context caching ===\n")

      // Execute the same goal 2 times with caching disabled
      // Each invocation will reload the Maven classloader (~500ms each)
      repeat(2) { iteration ->
        val output = ByteArrayOutputStream()

        println("Iteration ${iteration + 1}: Executing Maven goal (WITHOUT caching)...")
        val startTime = System.currentTimeMillis()

        val request = ExecutorRequest.mavenBuilder(Paths.get(mavenHome))
          .arguments(listOf("--version"))
          .cwd(workspaceRoot)
          .stdOut(output)
          .stdErr(System.err)
          .build()

        val exitCode = executor.execute(request)

        val duration = System.currentTimeMillis() - startTime
        println("Iteration ${iteration + 1}: Exit code=$exitCode, Duration=${duration}ms")
        println("(Notice each invocation takes longer when caching is disabled)\n")

        assert(exitCode == 0) { "Maven execution failed with exit code $exitCode" }
      }
    } finally {
      executor.close()
    }
  }
}
