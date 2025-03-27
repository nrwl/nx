package dev.nx.gradle

import com.google.gson.Gson
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.logging.Logger
import kotlin.system.exitProcess
import org.gradle.tooling.BuildLauncher
import org.gradle.tooling.GradleConnector
import org.gradle.tooling.ProjectConnection
import org.gradle.tooling.events.OperationType
import org.gradle.tooling.events.ProgressEvent
import org.gradle.tooling.events.task.TaskFailureResult
import org.gradle.tooling.events.task.TaskFinishEvent
import org.gradle.tooling.events.task.TaskStartEvent
import org.gradle.tooling.events.task.TaskSuccessResult

val logger: Logger = Logger.getLogger("NxBatchRunner")

data class NxBatchOptions(
    val workspaceRoot: String,
    val taskNames: List<String>,
    val args: String,
    val quiet: Boolean
)

fun main(args: Array<String>) {
  val options = parseArgs(args)
  configureLogger(options.quiet)

  if (options.workspaceRoot.isBlank()) {
    logger.severe("❌ Missing required arguments --workspaceRoot")
    exitProcess(1)
  }
  if (options.taskNames.isEmpty()) {
    logger.severe("❌ Missing required arguments --taskNames")
    exitProcess(1)
  }

  logger.info("  Workspace: ${options.workspaceRoot}")
  logger.info("  Tasks: ${options.taskNames}")
  logger.info("  Extra Args: ${options.args}")
  logger.info("  Quiet: ${options.quiet}")

  var connection: ProjectConnection? = null

  try {
    connection =
        GradleConnector.newConnector().forProjectDirectory(File(options.workspaceRoot)).connect()

    val results = runTasksInParallel(connection, options.taskNames, options.args)
    val reportJson = Gson().toJson(results)
    println(reportJson)
  } catch (e: Exception) {
    logger.severe("💥 Failed to run tasks: ${e.message}")
    exitProcess(1)
  } finally {
    try {
      connection?.close()
      logger.info("✅ Gradle connection closed.")
    } catch (e: Exception) {
      logger.warning("⚠️ Failed to close Gradle connection cleanly: ${e.message}")
    }
  }
}

fun parseArgs(args: Array<String>): NxBatchOptions {
  val argMap = mutableMapOf<String, String>()

  args.forEach {
    when {
      it.startsWith("--") && it.contains("=") -> {
        val (key, value) = it.split("=", limit = 2)
        argMap[key] = value
      }
      it.startsWith("--") -> {
        // Flag-style arguments like --quiet (no = sign)
        argMap[it] = "true"
      }
    }
  }

  return NxBatchOptions(
      workspaceRoot = argMap["--workspaceRoot"] ?: "",
      taskNames = argMap["--taskNames"]?.split(",")?.map { it.trim() } ?: emptyList(),
      args = argMap["--args"] ?: "",
      quiet = argMap["--quiet"]?.toBoolean() ?: false)
}

fun configureLogger(quiet: Boolean) {
  if (quiet) {
    logger.setLevel(java.util.logging.Level.OFF)
    logger.useParentHandlers = false
    logger.handlers.forEach { it.level = java.util.logging.Level.OFF }
  } else {
    logger.setLevel(java.util.logging.Level.INFO)
  }
}

data class TaskResult(
    val success: Boolean,
    val startTime: Long,
    val endTime: Long,
    var terminalOutput: String
)

fun runTasksInParallel(
    connection: ProjectConnection,
    taskNames: List<String>,
    additionalArgs: String
): Map<String, TaskResult> {
  logger.info("▶️ Running tasks in parallel: ${taskNames.joinToString(", ")}")

  val buildLauncher: BuildLauncher = connection.newBuild()
  val outputStream = ByteArrayOutputStream()
  val errorStream = ByteArrayOutputStream()

  val args = buildList {
    add("--continue")
    add("--parallel")
    add("-Dorg.gradle.daemon.idletimeout=10000")
    addAll(additionalArgs.split(" ").filter { it.isNotEmpty() })
  }

  buildLauncher.forTasks(*taskNames.toTypedArray())
  buildLauncher.withArguments(args)

  buildLauncher.setStandardOutput(outputStream)
  buildLauncher.setStandardError(errorStream)

  val taskStartTimes = mutableMapOf<String, Long>()
  val taskResults = mutableMapOf<String, TaskResult>()

  buildLauncher.addProgressListener(
      { event: ProgressEvent ->
        when (event) {
          is TaskStartEvent -> {
            taskStartTimes[event.descriptor.taskPath] = System.currentTimeMillis()
          }

          is TaskFinishEvent -> {
            val taskPath = event.descriptor.taskPath
            if (taskNames.contains(taskPath)) {
              val result = event.result
              val success: Boolean

              when (result) {
                is TaskSuccessResult -> {
                  success = true
                  logger.info("✅ Task finished successfully: $taskPath")
                }

                is TaskFailureResult -> {
                  success = false
                  val errorMessage =
                      result.failures.joinToString("\n") { it.message ?: "Unknown error" }
                  logger.warning("❌ Task failed: $taskPath")
                  logger.warning("   Failures: $errorMessage")
                }

                else -> {
                  success = true
                  logger.warning("⚠️ Task finished with unknown result: $taskPath $result")
                }
              }

              val endTime = result.endTime
              val startTime = taskStartTimes[taskPath] ?: result.startTime
              val duration = endTime - startTime
              taskResults[taskPath] =
                  TaskResult(
                      success = success,
                      startTime = startTime,
                      endTime = result.endTime,
                      terminalOutput = "")

              logger.info("⏱️ Task '$taskPath' duration: ${duration}ms")
            }
          }
        }
      },
      OperationType.TASK)

  val globalStart = System.currentTimeMillis()

  val globalOutput =
      try {
        buildLauncher.run()
        buildTerminalOutput(outputStream, errorStream)
      } catch (e: Exception) {
        logger.info("💥 Exception while running tasks: ${e.message}")
        buildTerminalOutput(outputStream, errorStream) + "\nException occurred: ${e.message}\n"
      } finally {
        outputStream.close()
        errorStream.close()
      }

  val globalEnd = System.currentTimeMillis()
  val totalDuration = globalEnd - globalStart
  logger.info("🧪 Total batch duration: ${totalDuration}ms")

  taskResults.values.forEach { it.terminalOutput = globalOutput }

  return taskResults
}

fun buildTerminalOutput(stdOut: ByteArrayOutputStream, stdErr: ByteArrayOutputStream): String {
  val output = stdOut.toString("UTF-8")
  val errorOutput = stdErr.toString("UTF-8")

  val builder = StringBuilder()
  if (output.isNotBlank()) {
    builder.append(output).append("\n")
  }
  if (errorOutput.isNotBlank()) {
    builder.append(errorOutput)
  }
  return builder.toString()
}
