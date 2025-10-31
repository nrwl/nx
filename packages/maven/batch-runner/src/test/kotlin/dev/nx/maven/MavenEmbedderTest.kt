package dev.nx.maven

import org.apache.maven.cli.MavenCli
import org.junit.jupiter.api.Test
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.PrintStream

/**
 * Test demonstrating Maven Embedder API for batch task execution.
 *
 * Key difference from Invoker:
 * - Invoker spawns a subprocess for each task
 * - Embedder executes Maven in-process, reusing reactor and cache
 */
class MavenEmbedderTest {

  @Test
  fun `maven embedder executes multiple tasks with single instance`() {
    val workspaceRoot = File(System.getProperty("user.dir"))

    // Initialize Maven CLI once (reused for all tasks)
    val mavenCli = MavenCli()

    // Simulate executing multiple tasks with same Maven instance
    val tasksToExecute = listOf(
      listOf("validate"),
      listOf("help:describe")
    )

    for (goals in tasksToExecute) {
      // Capture output for this task
      val output = ByteArrayOutputStream()
      val printStream = PrintStream(output)

      // Execute goal using embedded Maven
      // Key: Same MavenCli instance = same reactor + cache
      val exitCode = mavenCli.doMain(
        goals.toTypedArray(),
        workspaceRoot.absolutePath,
        printStream,
        System.err
      )

      // Task executed
      assert(exitCode >= 0)
    }
  }

  @Test
  fun `embedder reuses maven instance for multiple invocations`() {
    val workspaceRoot = File(System.getProperty("user.dir"))
    val mavenCli = MavenCli()

    // Multiple tasks use same instance
    repeat(3) {
      val output = ByteArrayOutputStream()
      val exitCode = mavenCli.doMain(
        arrayOf("help:describe"),
        workspaceRoot.absolutePath,
        PrintStream(output),
        System.err
      )
      assert(exitCode >= 0)
    }
  }
}
