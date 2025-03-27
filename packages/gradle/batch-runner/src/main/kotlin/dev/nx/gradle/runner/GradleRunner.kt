package dev.nx.gradle.runner

import dev.nx.gradle.data.GradlewTask
import dev.nx.gradle.data.TaskResult
import dev.nx.gradle.runner.OutputProcessor.buildTerminalOutput
import dev.nx.gradle.runner.OutputProcessor.splitOutputPerTask
import dev.nx.gradle.util.logger
import java.io.ByteArrayOutputStream
import kotlin.math.max
import kotlin.math.min
import org.gradle.tooling.ProjectConnection
import org.gradle.tooling.events.OperationType
import org.gradle.tooling.events.ProgressEvent
import org.gradle.tooling.events.task.*
import org.gradle.tooling.events.test.*

fun runTasksInParallel(
    connection: ProjectConnection,
    tasks: Map<String, GradlewTask>,
    additionalArgs: String,
): Map<String, TaskResult> {
  logger.info("▶️ Running all tasks in a single Gradle run: ${tasks.keys.joinToString(", ")}")

  val (testClassTasks, buildTasks) = tasks.entries.partition { it.value.testClassName != null }

  logger.info("🧪 Test launcher tasks: ${testClassTasks.joinToString(", ") { it.key }}")
  logger.info("🛠️ Build launcher tasks: ${buildTasks.joinToString(", ") { it.key }}")

  val allResults = mutableMapOf<String, TaskResult>()

  if (buildTasks.isNotEmpty()) {
    allResults.putAll(
        runLauncher(
            connection,
            buildTasks.associate { it.key to it.value },
            additionalArgs,
            useTestLauncher = false))
  }

  if (testClassTasks.isNotEmpty()) {
    allResults.putAll(
        runLauncher(
            connection,
            testClassTasks.associate { it.key to it.value },
            additionalArgs,
            useTestLauncher = true,
        ))
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
  val taskNames = tasks.values.map { it.taskName }.distinct()
  logger.info("$label executing tasks: ${taskNames.joinToString(", ")}")

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
              .find { entry -> entry.value.testClassName?.let { className.endsWith(it) } ?: false }
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
              .find { entry -> entry.value.testClassName?.let { className.endsWith(it) } ?: false }
              ?.key
              ?.let { nxTaskId ->
                testEndTimes.compute(nxTaskId) { _, old ->
                  max(old ?: event.eventTime, event.eventTime)
                }
                when (event.result) {
                  is TestSuccessResult -> logger.info("✅ Test passed: $nxTaskId $className")
                  is TestFailureResult -> {
                    testTaskStatus[nxTaskId] = false
                    logger.warning("❌ Test failed: $nxTaskId $className")
                  }
                  is TestSkippedResult -> logger.warning("⚠️ Test skipped: $nxTaskId $className")
                  else -> logger.warning("⚠️ Unknown test result: $nxTaskId $className")
                }
              }
        }
      }
    }
  }

  val outputStream = ByteArrayOutputStream()
  val errorStream = ByteArrayOutputStream()

  val args = buildList {
    addAll(listOf("--info", "--continue", "--parallel", "--build-cache"))
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
            forTasks(*taskNames.toTypedArray())
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
            forTasks(*taskNames.toTypedArray())
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
