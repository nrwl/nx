package dev.nx.gradle

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import dev.nx.gradle.data.GradlewTask
import dev.nx.gradle.data.NxBatchOptions
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.logging.Logger
import kotlin.system.exitProcess
import org.gradle.tooling.GradleConnector
import org.gradle.tooling.ProjectConnection
import org.gradle.tooling.events.OperationType
import org.gradle.tooling.events.ProgressEvent
import org.gradle.tooling.events.task.TaskFailureResult
import org.gradle.tooling.events.task.TaskFinishEvent
import org.gradle.tooling.events.task.TaskStartEvent
import org.gradle.tooling.events.task.TaskSuccessResult

val logger: Logger = Logger.getLogger("NxBatchRunner")

fun main(args: Array<String>) {
  val options = parseArgs(args)
  configureLogger(options.quiet)

  if (options.workspaceRoot.isBlank()) {
    logger.severe("❌ Missing required arguments --workspaceRoot")
    exitProcess(1)
  }
  if (options.tasks.isEmpty()) {
    logger.severe("❌ Missing required arguments --tasks")
    exitProcess(1)
  }

  logger.info("📂 Workspace: ${options.workspaceRoot}")
  logger.info("🧩 Tasks: ${options.tasks}")
  logger.info("⚙️ Extra Args: ${options.args}")
  logger.info("🔇 Quiet: ${options.quiet}")

  var connection: ProjectConnection? = null

  try {
    connection =
        GradleConnector.newConnector().forProjectDirectory(File(options.workspaceRoot)).connect()

    val results = runTasksInParallel(connection, options.tasks, options.args)
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
        argMap[it] = "true"
      }
    }
  }

  val gson = Gson()
  val tasksJson = argMap["--tasks"]
  val tasksMap: Map<String, GradlewTask> =
      if (tasksJson != null) {
        val taskType = object : TypeToken<Map<String, GradlewTask>>() {}.type
        gson.fromJson(tasksJson, taskType)
      } else emptyMap()

  return NxBatchOptions(
      workspaceRoot = argMap["--workspaceRoot"] ?: "",
      tasks = tasksMap,
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
    tasks: Map<String, GradlewTask>,
    additionalArgs: String
): Map<String, TaskResult> {
  logger.info("▶️ Running all tasks in a single Gradle run: ${tasks.keys.joinToString(", ")}")

  val (testTasks, buildTasks) =
      tasks.entries.partition {
        it.value.testClassName != null || it.value.taskName.endsWith(":test")
      }

  logger.info("🧪 Test tasks: ${testTasks.map { it.key }.joinToString(", ")}")
  logger.info("🏗️ Build tasks: ${buildTasks.map { it.key }.joinToString(", ")}")

  val allResults = mutableMapOf<String, TaskResult>()

  if (buildTasks.isNotEmpty()) {
    allResults.putAll(
        runLauncher(connection, buildTasks.associate { it.key to it.value }, additionalArgs, false))
  }

  if (testTasks.isNotEmpty()) {
    allResults.putAll(
        runLauncher(connection, testTasks.associate { it.key to it.value }, additionalArgs, true))
  }

  return allResults
}

fun runLauncher(
    connection: ProjectConnection,
    tasks: Map<String, GradlewTask>,
    additionalArgs: String,
    useTestLauncher: Boolean
): Map<String, TaskResult> {
  val label = if (useTestLauncher) "🧪 TestLauncher" else "🏗️ BuildLauncher"
  val allTaskNames = tasks.values.map { it.taskName }.distinct()
  logger.info("$label executing tasks: ${allTaskNames.joinToString(", ")}")

  val taskStartTimes = mutableMapOf<String, Long>()
  val taskResults = mutableMapOf<String, TaskResult>()

  val listener = { event: ProgressEvent ->
    when (event) {
      is TaskStartEvent -> {
        taskStartTimes[event.descriptor.taskPath] = System.currentTimeMillis()
      }
      is TaskFinishEvent -> {
        val taskPath = event.descriptor.taskPath
        if (allTaskNames.contains(taskPath)) {
          val success =
              when (val result = event.result) {
                is TaskSuccessResult -> {
                  logger.info("✅ Task finished successfully: $taskPath")
                  true
                }
                is TaskFailureResult -> {
                  logger.warning("❌ Task failed: $taskPath")
                  logger.warning(
                      "   Failures: ${result.failures.joinToString("\n") { it.message ?: "Unknown error" }}")
                  false
                }
                else -> {
                  logger.warning("⚠️ Task finished with unknown result: $taskPath $result")
                  true
                }
              }

          val endTime = System.currentTimeMillis()
          val startTime = taskStartTimes[taskPath] ?: endTime
          val nxTaskId = tasks.entries.find { it.value.taskName == taskPath }?.key
          if (nxTaskId != null) {
            taskResults[nxTaskId] = TaskResult(success, startTime, endTime, "")
          }
        }
      }
    }
  }

  val outputStream = ByteArrayOutputStream()
  val errorStream = ByteArrayOutputStream()

  val args = buildList {
    addAll(listOf("--info", "--continue", "--parallel", "-Dorg.gradle.daemon.idletimeout=10000"))

    if (!useTestLauncher) {
      addAll(listOf("--exclude-task", "test"))
    }

    addAll(additionalArgs.split(" ").filter { it.isNotBlank() })
  }

  logger.info("🛠️ Gradle args: ${args.joinToString(" ")}")

  val globalStart = System.currentTimeMillis()
  var globalOutput: String

  try {
    if (useTestLauncher) {
      val testLauncher =
          connection.newTestLauncher().apply {
            forTasks(*allTaskNames.toTypedArray())
            tasks.values.forEach { task -> task.testClassName?.let { withJvmTestClasses(it) } }
            withArguments(*args.toTypedArray())
            setStandardOutput(outputStream)
            setStandardError(errorStream)
            addProgressListener(listener, OperationType.TEST)
          }
      testLauncher.run()
    } else {
      val buildLauncher =
          connection.newBuild().apply {
            forTasks(*allTaskNames.toTypedArray())
            withArguments(*args.toTypedArray())
            setStandardOutput(outputStream)
            setStandardError(errorStream)
            addProgressListener(listener, OperationType.TASK)
          }
      buildLauncher.run()
    }

    globalOutput = buildTerminalOutput(outputStream, errorStream)
  } catch (e: Exception) {
    globalOutput =
        buildTerminalOutput(outputStream, errorStream) + "\nException occurred: ${e.message}"
    logger.warning("💥 Gradle run failed: ${e.message}")
    logger.warning("📄 Output before failure:\n${globalOutput.take(2000)}")
  } finally {
    outputStream.close()
    errorStream.close()
  }

  val globalEnd = System.currentTimeMillis()
  val totalDuration = globalEnd - globalStart
  logger.info("🧪 Total batch duration: ${totalDuration}ms")

  val perTaskOutput = splitOutputPerTask(globalOutput)

  if (perTaskOutput.isEmpty()) {
    logger.warning("⚠️ Could not split terminal output by task — defaulting to full output.")
  }

  tasks.forEach { (taskId, taskConfig) ->
    val taskOutput =
        if (taskConfig.testClassName != null) {
          globalOutput
        } else {
          perTaskOutput[taskConfig.taskName] ?: globalOutput
        }
    if (!taskResults.containsKey(taskId)) {
      taskResults[taskId] =
          TaskResult(
              success = !taskOutput.contains("BUILD FAILED"),
              startTime = globalStart,
              endTime = globalEnd,
              terminalOutput = taskOutput)
    } else {
      val existing = taskResults[taskId]
      if (existing != null) {
        taskResults[taskId] = existing.copy(terminalOutput = taskOutput)
      }
    }
  }

  logger.info("✅ Finished ${if (useTestLauncher) "test" else "build"} tasks")
  return taskResults
}

fun buildTerminalOutput(stdOut: ByteArrayOutputStream, stdErr: ByteArrayOutputStream): String {
  val output = stdOut.toString("UTF-8")
  val errorOutput = stdErr.toString("UTF-8")
  val builder = StringBuilder()
  if (output.isNotBlank()) builder.append(output).append("\n")
  if (errorOutput.isNotBlank()) builder.append(errorOutput)
  return builder.toString()
}

fun splitOutputPerTask(globalOutput: String): Map<String, String> {
  val unescapedOutput = globalOutput.replace("\\u003e", ">").replace("\\n", "\n")
  val taskHeaderRegex = Regex("(?=> Task (:[^\\s]+))")
  val sections = unescapedOutput.split(taskHeaderRegex)
  val taskOutputMap = mutableMapOf<String, String>()

  for (section in sections) {
    val lines = section.trim().lines()
    if (lines.isEmpty()) continue
    val header = lines.firstOrNull { it.startsWith("> Task ") }
    if (header != null) {
      val taskMatch = Regex("> Task (:[^\\s]+)").find(header)
      val taskName = taskMatch?.groupValues?.get(1) ?: continue
      taskOutputMap[taskName] = section.trim()
    }
  }

  return taskOutputMap
}
