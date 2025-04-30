package dev.nx.gradle.runner

import dev.nx.gradle.data.GradleTask
import dev.nx.gradle.data.TaskResult
import dev.nx.gradle.runner.OutputProcessor.buildTerminalOutput
import dev.nx.gradle.runner.OutputProcessor.finalizeTaskResults
import dev.nx.gradle.util.logger
import java.io.ByteArrayOutputStream
import org.gradle.tooling.ProjectConnection
import org.gradle.tooling.events.OperationType

fun runTasksInParallel(
    connection: ProjectConnection,
    tasks: Map<String, GradleTask>,
    additionalArgs: String,
    excludeTasks: List<String>
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
    // --parallel is for performance
    // -Dorg.gradle.daemon.idletimeout=10000 is to kill daemon after 10 seconds
    addAll(listOf("--info", "--continue", "-Dorg.gradle.daemon.idletimeout=10000"))
    addAll(additionalArgs.split(" ").filter { it.isNotBlank() })

    // Add --exclude-task for each excluded task
    if (excludeTasks.isNotEmpty()) {
      excludeTasks.forEach { taskName ->
        add("--exclude-task")
        add(taskName)
      }
    }
  }
  logger.info("🏳️ Args: ${args.joinToString(", ")}")

  if (buildTasks.isNotEmpty()) {
    allResults.putAll(
        runBuildLauncher(
            connection,
            buildTasks.associate { it.key to it.value },
            args,
            outputStream,
            errorStream))
  }

  if (testClassTasks.isNotEmpty()) {
    allResults.putAll(
        runTestLauncher(
            connection,
            testClassTasks.associate { it.key to it.value },
            args,
            outputStream,
            errorStream))
  }

  return allResults
}

fun runBuildLauncher(
    connection: ProjectConnection,
    tasks: Map<String, GradleTask>,
    args: List<String>,
    outputStream: ByteArrayOutputStream,
    errorStream: ByteArrayOutputStream
): Map<String, TaskResult> {
  val taskNames = tasks.values.map { it.taskName }.distinct().toTypedArray()
  logger.info("📋 Collected ${taskNames.size} unique task names: ${taskNames.joinToString(", ")}")

  val taskStartTimes = mutableMapOf<String, Long>()
  val taskResults = mutableMapOf<String, TaskResult>()

  val globalStart = System.currentTimeMillis()
  var globalOutput: String

  try {
    connection
        .newBuild()
        .apply {
          forTasks(*taskNames)
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
    logger.warning("\ud83d\udca5 Gradle run failed: ${e.message} ${errorStream}")
  } finally {
    outputStream.close()
    errorStream.close()
  }

  val globalEnd = System.currentTimeMillis()
  finalizeTaskResults(
      tasks = tasks,
      taskResults = taskResults,
      globalOutput = globalOutput,
      errorStream = errorStream,
      globalStart = globalStart,
      globalEnd = globalEnd)

  logger.info("\u2705 Finished build tasks")
  return taskResults
}

fun runTestLauncher(
    connection: ProjectConnection,
    tasks: Map<String, GradleTask>,
    args: List<String>,
    outputStream: ByteArrayOutputStream,
    errorStream: ByteArrayOutputStream
): Map<String, TaskResult> {
  val taskNames = tasks.values.map { it.taskName }.distinct().toTypedArray()
  logger.info("📋 Collected ${taskNames.size} unique task names: ${taskNames.joinToString(", ")}")

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
          forTasks(*taskNames)
          tasks.values
              .mapNotNull { it.testClassName }
              .forEach {
                logger.info("Registering test class: $it")
                withArguments("--tests", it)
                withJvmTestClasses(it)
              }
          withArguments(
              *args.toTypedArray(),
              "-Dorg.gradle.workers.max=3",
              "-PmaxParallelForks=3",
              "-Dorg.gradle.parallel=true")
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
    logger.warning(errorStream.toString())
    globalOutput =
        buildTerminalOutput(outputStream, errorStream) + "\nException occurred: ${e.message}"
    logger.warning("\ud83d\udca5 Gradle test run failed: ${e.message} ${errorStream}")
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

  finalizeTaskResults(
      tasks = tasks,
      taskResults = taskResults,
      globalOutput = globalOutput,
      errorStream = errorStream,
      globalStart = globalStart,
      globalEnd = globalEnd)

  logger.info("\u2705 Finished test tasks")
  return taskResults
}
