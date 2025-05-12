package dev.nx.gradle.runner

import dev.nx.gradle.data.GradleTask
import dev.nx.gradle.data.TaskResult
import dev.nx.gradle.runner.OutputProcessor.buildTerminalOutput
import dev.nx.gradle.runner.OutputProcessor.splitOutputPerTask
import dev.nx.gradle.util.logger
import java.io.ByteArrayOutputStream
import org.gradle.tooling.ProjectConnection
import org.gradle.tooling.events.OperationType

fun runTasksInParallel(
    connection: ProjectConnection,
    tasks: Map<String, GradleTask>,
    additionalArgs: String,
): Map<String, TaskResult> {
  logger.info("▶️ Running all tasks in a single Gradle run: ${tasks.keys.joinToString(", ")}")

  val (testClassTasks, buildTasks) = tasks.entries.partition { it.value.testClassName != null }

  logger.info("🧪 Test launcher tasks: ${testClassTasks.joinToString(", ") { it.key }}")
  logger.info("🛠️ Build launcher tasks: ${buildTasks.joinToString(", ") { it.key }}")

  val allResults = mutableMapOf<String, TaskResult>()

  val outputStream = ByteArrayOutputStream()
  val errorStream = ByteArrayOutputStream()

  val args = buildList {
    // --info is for terminal per task
    // --continue is for continue running tasks if one failed in a batch
    // --parallel and --build-cache are for performance
    // -Dorg.gradle.daemon.idletimeout=10000 is to kill daemon after 10 seconds
    addAll(
        listOf(
            "--info",
            "--continue",
            "--parallel",
            "--build-cache",
            "-Dorg.gradle.daemon.idletimeout=10000"))
    addAll(additionalArgs.split(" ").filter { it.isNotBlank() })
  }
  logger.info("🏳️ Args: ${args.joinToString(", ")}")

  val taskNames = tasks.values.map { it.taskName }.distinct()

  if (buildTasks.isNotEmpty()) {
    allResults.putAll(
        runBuildLauncher(
            connection,
            buildTasks.associate { it.key to it.value },
            taskNames,
            args,
            outputStream,
            errorStream))
  }

  if (testClassTasks.isNotEmpty()) {
    allResults.putAll(
        runTestLauncher(
            connection,
            testClassTasks.associate { it.key to it.value },
            taskNames,
            args,
            outputStream,
            errorStream))
  }

  return allResults
}

fun runBuildLauncher(
    connection: ProjectConnection,
    tasks: Map<String, GradleTask>,
    taskNames: List<String>,
    args: List<String>,
    outputStream: ByteArrayOutputStream,
    errorStream: ByteArrayOutputStream
): Map<String, TaskResult> {
  val taskStartTimes = mutableMapOf<String, Long>()
  val taskResults = mutableMapOf<String, TaskResult>()

  var globalOutput: String

  try {
    connection
        .newBuild()
        .apply {
          forTasks(*taskNames.toTypedArray())
          withArguments(*args.toTypedArray())
          setStandardOutput(outputStream)
          setStandardError(errorStream)
          addProgressListener(buildListener(tasks, taskStartTimes, taskResults), OperationType.TASK)
        }
        .run()
    globalOutput = buildTerminalOutput(outputStream, errorStream)
  } catch (e: Exception) {
    globalOutput =
        buildTerminalOutput(outputStream, errorStream) + "\nException occurred: ${e.message}"
    logger.warning("\ud83d\udca5 Gradle run failed: ${e.message}")
  } finally {
    outputStream.close()
    errorStream.close()
  }

  val perTaskOutput = splitOutputPerTask(globalOutput)
  tasks.forEach { (taskId, taskConfig) ->
    val taskOutput = perTaskOutput[taskConfig.taskName] ?: globalOutput
    taskResults[taskId]?.let { taskResults[taskId] = it.copy(terminalOutput = taskOutput) }
  }

  logger.info("\u2705 Finished build tasks")
  return taskResults
}

fun runTestLauncher(
    connection: ProjectConnection,
    tasks: Map<String, GradleTask>,
    taskNames: List<String>,
    args: List<String>,
    outputStream: ByteArrayOutputStream,
    errorStream: ByteArrayOutputStream
): Map<String, TaskResult> {
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

  val globalStart = System.currentTimeMillis()
  var globalOutput: String

  try {
    connection
        .newTestLauncher()
        .apply {
          forTasks(*taskNames.toTypedArray())
          tasks.values.mapNotNull { it.testClassName }.forEach { withJvmTestClasses(it) }
          withArguments(*args.toTypedArray())
          setStandardOutput(outputStream)
          setStandardError(errorStream)
          addProgressListener(
              testListener(
                  tasks, taskStartTimes, taskResults, testTaskStatus, testStartTimes, testEndTimes),
              OperationType.TEST)
        }
        .run()
    globalOutput = buildTerminalOutput(outputStream, errorStream)
  } catch (e: Exception) {
    globalOutput =
        buildTerminalOutput(outputStream, errorStream) + "\nException occurred: ${e.message}"
    logger.warning("\ud83d\udca5 Gradle test run failed: ${e.message}")
  } finally {
    outputStream.close()
    errorStream.close()
  }

  val globalEnd = System.currentTimeMillis()

  tasks.forEach { (nxTaskId, taskConfig) ->
    if (taskConfig.testClassName != null) {
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

  logger.info("\u2705 Finished test tasks")
  return taskResults
}
