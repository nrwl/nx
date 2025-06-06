package dev.nx.gradle

import com.google.gson.Gson
import dev.nx.gradle.cli.parseArgs
import dev.nx.gradle.runner.runTasksInParallel
import dev.nx.gradle.util.configureSingleLineLogger
import dev.nx.gradle.util.logger
import java.io.File
import kotlin.system.exitProcess
import kotlinx.coroutines.runBlocking
import org.gradle.tooling.GradleConnector
import org.gradle.tooling.ProjectConnection

fun main(args: Array<String>) {
  val options = parseArgs(args)
  configureSingleLineLogger(options.quiet)
  logger.info("NxBatchOptions: $options")

  if (options.workspaceRoot.isBlank()) {
    logger.severe("❌ Missing required arguments --workspaceRoot")
    exitProcess(1)
  }

  if (options.tasks.isEmpty()) {
    logger.severe("❌ Missing required arguments --tasks")
    exitProcess(1)
  }

  var buildConnection: ProjectConnection? = null

  try {
    val connector = GradleConnector.newConnector().forProjectDirectory(File(options.workspaceRoot))

    buildConnection = connector.connect()

    val results = runBlocking {
      runTasksInParallel(
          buildConnection,
          options.tasks,
          options.args,
          options.excludeTasks,
          options.excludeTestTasks)
    }

    val reportJson = Gson().toJson(results)
    println(reportJson)

    val summary = results.values.groupBy { it.success }
    logger.info(
        "📊 Summary: ✅ ${summary[true]?.size ?: 0} succeeded, ❌ ${summary[false]?.size ?: 0} failed")
  } catch (e: Exception) {
    logger.severe("💥 Failed to run tasks: ${e.message}")
    exitProcess(1)
  } finally {
    try {
      buildConnection?.close()
      logger.info("✅ Gradle connection closed.")
    } catch (e: Exception) {
      logger.warning("⚠️ Failed to close Gradle connection cleanly: ${e.message}")
    }
  }
}
