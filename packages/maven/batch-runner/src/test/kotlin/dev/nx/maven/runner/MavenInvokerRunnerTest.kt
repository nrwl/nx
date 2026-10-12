package dev.nx.maven.runner

import dev.nx.maven.data.MavenBatchOptions
import dev.nx.maven.data.MavenBatchTask
import org.junit.jupiter.api.Test
import java.io.File
import kotlin.test.assertTrue

class MavenInvokerRunnerTest {
  @Test
  fun `should include global arguments in Maven command`() {
    val options = MavenBatchOptions(
      workspaceRoot = "/tmp",
      taskOptions = emptyMap(),
      args = listOf("--settings", "settings.xml", "-DskipTests"),
      verbose = false
    )
    val runner = MavenInvokerRunner(File("/tmp"), options)

    val task = MavenBatchTask(
      id = "task1",
      project = "my-project",
      goals = listOf("install"),
      args = listOf("-DsomeProp=someValue")
    )

    val arguments = runner.buildArguments(task)

    // Check that it contains project selector
    assertTrue(arguments.contains("-pl"))
    assertTrue(arguments.contains("my-project"))

    // Check that it contains task-specific arguments
    assertTrue(arguments.contains("-DsomeProp=someValue"))

    // Check that it contains global arguments (this is what is currently missing)
    assertTrue(arguments.contains("--settings"), "Should contain global --settings")
    assertTrue(arguments.contains("settings.xml"), "Should contain global settings.xml")
    assertTrue(arguments.contains("-DskipTests"), "Should contain global -DskipTests")
  }

  @Test
  fun `should translate --verbose to -X -e`() {
    val options = MavenBatchOptions(
      workspaceRoot = "/tmp",
      taskOptions = emptyMap(),
      args = listOf("--verbose"),
      verbose = false
    )
    val runner = MavenInvokerRunner(File("/tmp"), options)

    val task = MavenBatchTask(
      id = "task1",
      project = "my-project",
      goals = listOf("install"),
      args = emptyList()
    )

    val arguments = runner.buildArguments(task)

    assertTrue(arguments.contains("-X"), "Should translate --verbose to -X")
    assertTrue(arguments.contains("-e"), "Should translate --verbose to include -e")
    assertTrue(!arguments.contains("--verbose"), "Should not contain --verbose")
  }

  @Test
  fun `should skip unrecognized double-dash arguments`() {
    val options = MavenBatchOptions(
      workspaceRoot = "/tmp",
      taskOptions = emptyMap(),
      args = listOf("--nx-flag", "some-value", "--settings", "settings.xml"),
      verbose = false
    )
    val runner = MavenInvokerRunner(File("/tmp"), options)

    val task = MavenBatchTask(
      id = "task1",
      project = "my-project",
      goals = listOf("install"),
      args = emptyList()
    )

    val arguments = runner.buildArguments(task)

    assertTrue(!arguments.contains("--nx-flag"), "Should skip --nx-flag")
    assertTrue(!arguments.contains("some-value"), "Should skip potential value for --nx-flag")
    assertTrue(arguments.contains("--settings"), "Should keep valid --settings")
    assertTrue(arguments.contains("settings.xml"), "Should keep value for --settings")
  }

  @Test
  fun `should keep double-dash arguments with equals sign`() {
    val options = MavenBatchOptions(
      workspaceRoot = "/tmp",
      taskOptions = emptyMap(),
      args = listOf("--settings=settings.xml", "--invalid=val"),
      verbose = false
    )
    val runner = MavenInvokerRunner(File("/tmp"), options)

    val task = MavenBatchTask(
      id = "task1",
      project = "my-project",
      goals = listOf("install"),
      args = emptyList()
    )

    val arguments = runner.buildArguments(task)

    assertTrue(arguments.contains("--settings=settings.xml"), "Should keep --settings=settings.xml")
    assertTrue(!arguments.contains("--invalid=val"), "Should skip --invalid=val")
  }

  @Test
  fun `should translate --quiet to -q`() {
    val options = MavenBatchOptions(
      workspaceRoot = "/tmp",
      taskOptions = emptyMap(),
      args = listOf("--quiet"),
      verbose = false
    )
    val runner = MavenInvokerRunner(File("/tmp"), options)

    val task = MavenBatchTask(
      id = "task1",
      project = "my-project",
      goals = listOf("install"),
      args = emptyList()
    )

    val arguments = runner.buildArguments(task)

    assertTrue(arguments.contains("-q"), "Should translate --quiet to -q")
    assertTrue(!arguments.contains("--quiet"), "Should not contain --quiet")
  }
}
