package dev.nx.gradle

import dev.nx.gradle.cli.parseArgs
import dev.nx.gradle.data.NxTaskGraph
import dev.nx.gradle.runner.runTasksWithGraph
import dev.nx.gradle.util.configureSingleLineLogger
import dev.nx.gradle.util.logger
import java.io.File
import kotlin.system.exitProcess
import org.gradle.tooling.GradleConnector
import org.gradle.tooling.ProjectConnection

fun main(args: Array<String>) {
  val options = parseArgs(args)
  configureSingleLineLogger(options.quiet)
  logger.info("NxBatchOptions: $options")

  if (options.workspaceRoot.isBlank()) {
    logger.severe("Missing required arguments --workspaceRoot")
    exitProcess(1)
  }

  if (options.tasks.isEmpty()) {
    logger.severe("Missing required arguments --tasks")
    exitProcess(1)
  }

  // Use provided task graph or fall back to a flat graph with all tasks as roots
  val taskGraph =
      options.taskGraph
          ?: NxTaskGraph(
              roots = options.tasks.keys.toList(),
              dependencies = options.tasks.keys.associateWith { emptyList() })

  var buildConnection: ProjectConnection? = null

  try {
    val connector = GradleConnector.newConnector().forProjectDirectory(File(options.workspaceRoot))

    buildConnection = connector.connect()
    logger.info("Gradle connection open.")

    val results =
        runTasksWithGraph(
            buildConnection,
            options.tasks,
            taskGraph,
            options.args,
            options.excludeTasks,
            options.excludeTestTasks)

    val summary = results.values.groupBy { it.success }
    logger.info(
        "Summary: ${summary[true]?.size ?: 0} succeeded, ${summary[false]?.size ?: 0} failed")
    logger.info("Batch execution complete")
  } catch (e: Exception) {
    logger.severe("Failed to run tasks: ${e.message}")
    exitProcess(1)
  } finally {
    try {
      buildConnection?.close()
      logger.info("Gradle connection closed.")
    } catch (e: Exception) {
      logger.warning("Failed to close Gradle connection cleanly: ${e.message}")
    }
  }
}
