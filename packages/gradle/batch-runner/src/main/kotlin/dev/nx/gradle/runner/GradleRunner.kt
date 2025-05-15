package dev.nx.gradle.runner

import dev.nx.gradle.data.GradleTask
import dev.nx.gradle.data.TaskResult
import dev.nx.gradle.runner.OutputProcessor.buildTerminalOutput
import dev.nx.gradle.runner.OutputProcessor.finalizeTaskResults
import dev.nx.gradle.util.logger
import java.io.ByteArrayOutputStream
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import org.gradle.tooling.ProjectConnection
import org.gradle.tooling.events.OperationType

suspend fun runTasksInParallel(
    connection: ProjectConnection,
    tasks: Map<String, GradleTask>,
    additionalArgs: String,
    excludeTasks: List<String>
): Map<String, TaskResult> = coroutineScope {
  logger.info("▶️ Running all tasks in a single Gradle run: ${tasks.keys.joinToString(", ")}")

  val (testClassTasks, buildTasks) = tasks.entries.partition { it.value.testClassName != null }

  logger.info("🧪 Test launcher tasks: ${testClassTasks.joinToString(", ") { it.key }}")
  logger.info("🛠️ Build launcher tasks: ${buildTasks.joinToString(", ") { it.key }}")

  val outputStream1 = ByteArrayOutputStream()
  val errorStream1 = ByteArrayOutputStream()
  val outputStream2 = ByteArrayOutputStream()
  val errorStream2 = ByteArrayOutputStream()

  val args = buildList {
    // --info is for terminal per task
    // --continue is for continue running tasks if one failed in a batch
    // --parallel is for performance
    // -Dorg.gradle.daemon.idletimeout=10000 is to kill daemon after 10 seconds
    addAll(listOf("--info", "--continue", "-Dorg.gradle.daemon.idletimeout=10000"))
    addAll(additionalArgs.split(" ").filter { it.isNotBlank() })
    excludeTasks.forEach {
      add("--exclude-task")
      add(it)
    }
  }

  logger.info("🏳️ Args: ${args.joinToString(", ")}")

  val buildJob = async {
    if (buildTasks.isNotEmpty()) {
      runBuildLauncher(
          connection,
          buildTasks.associate { it.key to it.value },
          args,
          outputStream1,
          errorStream1)
    } else emptyMap()
  }

  val testJob = async {
    if (testClassTasks.isNotEmpty()) {
      runTestLauncher(
          connection,
          testClassTasks.associate { it.key to it.value },
          args,
          outputStream2,
          errorStream2)
    } else emptyMap()
  }

  val allResults = mutableMapOf<String, TaskResult>()
  allResults.putAll(buildJob.await())
  allResults.putAll(testJob.await())

  return@coroutineScope allResults
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
    logger.warning("\ud83d\udca5 Gradle run failed: ${e.message} $errorStream")
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
    logger.warning(errorStream.toString())
    globalOutput =
        buildTerminalOutput(outputStream, errorStream) + "\nException occurred: ${e.message}"
    logger.warning("\ud83d\udca5 Gradle test run failed: ${e.message} $errorStream")
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
