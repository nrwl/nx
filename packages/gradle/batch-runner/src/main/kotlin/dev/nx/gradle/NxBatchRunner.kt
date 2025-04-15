package dev.nx.gradle

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import dev.nx.gradle.data.GradlewTask
import dev.nx.gradle.data.NxBatchOptions
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.logging.Logger
import kotlin.math.max
import kotlin.math.min
import kotlin.system.exitProcess
import org.gradle.tooling.GradleConnector
import org.gradle.tooling.ProjectConnection
import org.gradle.tooling.events.OperationType
import org.gradle.tooling.events.ProgressEvent
import org.gradle.tooling.events.task.*
import org.gradle.tooling.events.test.*

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

  val testTaskStatus = mutableMapOf<String, Boolean>()
  val testStartTimes = mutableMapOf<String, Long>()
  val testEndTimes = mutableMapOf<String, Long>()
  tasks.forEach { (nxTaskId, taskConfig) ->
    if (taskConfig.testClassName != null) {
      testTaskStatus[nxTaskId] = true
    }
  }

  val buildListener: (ProgressEvent) -> Unit = { event ->
    when (event) {
      is TaskStartEvent -> {
        tasks.entries
            .find { it.value.taskName == event.descriptor.taskPath }
            ?.key
            ?.let { nxTaskId ->
              taskStartTimes[nxTaskId] = min(System.currentTimeMillis(), event.eventTime)
            }
      }
      is TaskFinishEvent -> {
        val taskPath = event.descriptor.taskPath
        val success =
            when (event.result) {
              is TaskSuccessResult -> {
                logger.info("✅ Task finished successfully: $taskPath")
                true
              }
              is TaskFailureResult -> {
                logger.warning("❌ Task failed: $taskPath")
                false
              }
              else -> true
            }

        tasks.entries
            .find { it.value.taskName == taskPath }
            ?.key
            ?.let { nxTaskId ->
              val endTime = max(System.currentTimeMillis(), event.eventTime)
              val startTime = taskStartTimes[nxTaskId] ?: event.result.startTime
              taskResults[nxTaskId] = TaskResult(success, startTime, endTime, "")
            }
      }
    }
  }

  val testListener: (ProgressEvent) -> Unit = { event ->
    when (event) {
      is TaskStartEvent,
      is TaskFinishEvent -> buildListener(event)
      is TestStartEvent -> {

        (event.descriptor as? JvmTestOperationDescriptor)?.className?.let { className ->
          tasks.entries
              .find { entry ->
                val testClass = entry.value.testClassName
                testClass != null && className.endsWith(testClass)
              }
              ?.key
              ?.let { nxTaskId ->
                testStartTimes.compute(nxTaskId) { _, old ->
                  min(old ?: event.eventTime, event.eventTime)
                }
              }
        }
      }
      is TestFinishEvent -> {
        (event.descriptor as? JvmTestOperationDescriptor)?.className?.let { className ->
          tasks.entries
              .find { entry ->
                val testClass = entry.value.testClassName
                testClass != null && className.endsWith(testClass)
              }
              ?.key
              ?.let { nxTaskId ->
                testEndTimes.compute(nxTaskId) { _, old ->
                  max(old ?: event.eventTime, event.eventTime)
                }

                when (event.result) {
                  is TestSuccessResult -> {
                    // do nothing, it already defaulted to true
                    logger.info("✅ Test passed: $nxTaskId $className ${event.descriptor.name}")
                  }
                  is TestFailureResult -> {
                    testTaskStatus[nxTaskId] = false
                    logger.warning("❌ Test failed: $nxTaskId $className ${event.descriptor.name}")
                  }
                  is TestSkippedResult -> {
                    logger.warning("⚠️ Test skipped: $nxTaskId $className ${event.descriptor.name}")
                  }
                  else -> {
                    logger.warning(
                        "⚠️ Test finished with unknown result: $nxTaskId $className ${event.descriptor.name}")
                  }
                }
              }
        }
      }
    }
  }

  val outputStream = ByteArrayOutputStream()
  val errorStream = ByteArrayOutputStream()

  val args = buildList {
    addAll(listOf("--info", "--continue", "--parallel", "-Dorg.gradle.daemon.idletimeout=10000"))
    if (!useTestLauncher) addAll(listOf("--exclude-task", "test"))
    addAll(additionalArgs.split(" ").filter { it.isNotBlank() })
  }

  logger.info("🛠️ Gradle args: ${args.joinToString(" ")}")

  val globalStart = System.currentTimeMillis()
  var globalOutput: String

  try {
    if (useTestLauncher) {
      connection
          .newTestLauncher()
          .apply {
            forTasks(*allTaskNames.toTypedArray())
            tasks.values.mapNotNull { it.testClassName }.forEach { withJvmTestClasses(it) }
            withArguments(*args.toTypedArray())
            setStandardOutput(outputStream)
            setStandardError(errorStream)
            addProgressListener(testListener, OperationType.TEST)
          }
          .run()
    } else {
      connection
          .newBuild()
          .apply {
            forTasks(*allTaskNames.toTypedArray())
            withArguments(*args.toTypedArray())
            setStandardOutput(outputStream)
            setStandardError(errorStream)
            addProgressListener(buildListener, OperationType.TASK)
          }
          .run()
    }
    globalOutput = buildTerminalOutput(outputStream, errorStream)
  } catch (e: Exception) {
    globalOutput =
        buildTerminalOutput(outputStream, errorStream) + "\nException occurred: ${e.message}"
    logger.warning("💥 Gradle run failed: ${e.message}")
  } finally {
    outputStream.close()
    errorStream.close()
  }

  val globalEnd = System.currentTimeMillis()

  tasks.forEach { (nxTaskId, taskConfig) ->
    val isTestTask = taskConfig.testClassName != null
    if (isTestTask) {
      val success = testTaskStatus[nxTaskId] ?: false
      val startTime = testStartTimes[nxTaskId] ?: globalStart
      val endTime = testEndTimes[nxTaskId] ?: globalEnd

      if (!taskResults.containsKey(nxTaskId)) {
        taskResults[nxTaskId] = TaskResult(success, startTime, endTime, "")
      }
    }
  }
  val perTaskOutput = splitOutputPerTask(globalOutput)

  tasks.forEach { (taskId, taskConfig) ->
    val taskOutput = perTaskOutput[taskConfig.taskName] ?: globalOutput
    taskResults[taskId]?.let { taskResults[taskId] = it.copy(terminalOutput = taskOutput) }
  }

  logger.info("✅ Finished ${if (useTestLauncher) "test" else "build"} tasks")
  return taskResults
}

fun buildTerminalOutput(stdOut: ByteArrayOutputStream, stdErr: ByteArrayOutputStream): String {
  val output = stdOut.toString("UTF-8")
  val errorOutput = stdErr.toString("UTF-8")
  return buildString {
    if (output.isNotBlank()) append(output).append("\n")
    if (errorOutput.isNotBlank()) append(errorOutput)
  }
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
