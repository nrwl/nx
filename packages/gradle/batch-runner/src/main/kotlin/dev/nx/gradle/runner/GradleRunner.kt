package dev.nx.gradle.runner

import dev.nx.gradle.data.GradleTask
import dev.nx.gradle.data.TaskResult
import dev.nx.gradle.runner.OutputProcessor.buildTerminalOutput
import dev.nx.gradle.runner.OutputProcessor.finalizeTaskResults
import dev.nx.gradle.util.logger
import java.io.ByteArrayOutputStream
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import org.gradle.tooling.BuildCancelledException
import org.gradle.tooling.ProjectConnection
import org.gradle.tooling.events.OperationType

suspend fun runTasksInParallel(
    connection: ProjectConnection,
    tasks: Map<String, GradleTask>,
    additionalArgs: String,
    excludeTasks: List<String>,
    excludeTestTasks: List<String>
): Map<String, TaskResult> = coroutineScope {
  logger.info("▶️ Running all tasks in a single Gradle run: ${tasks.keys.joinToString(", ")}")

  val (testClassTasks, buildTasks) = tasks.entries.partition { it.value.testClassName != null }

  logger.info("🧪 Test launcher tasks: ${testClassTasks.joinToString(", ") { it.key }}")
  logger.info("🛠️ Build launcher tasks: ${buildTasks.joinToString(", ") { it.key }}")

  val outputStream1 = ByteArrayOutputStream()
  val errorStream1 = ByteArrayOutputStream()
  val outputStream2 = ByteArrayOutputStream()
  val errorStream2 = ByteArrayOutputStream()

  // --info is for terminal per task
  // --continue is for continue running tasks if one failed in a batch
  // --parallel is for performance
  // -Dorg.gradle.daemon.idletimeout=10000 is to kill daemon after 0 ms
  val cpuCores = Runtime.getRuntime().availableProcessors()
  val workersMax = (cpuCores * 0.5).toInt().coerceAtLeast(1)
  val args =
      mutableListOf(
          "--info",
          "--continue",
          "-Dorg.gradle.daemon.idletimeout=0",
          "--parallel",
          "-Dorg.gradle.workers.max=$workersMax")

  if (additionalArgs.isNotBlank()) {
    val splitResult = additionalArgs.split(" ")
    val filteredResult = splitResult.filter { it.isNotBlank() }
    args.addAll(filteredResult)
  }

  logger.info("🏳️ Args: ${args.joinToString(", ")}")

  val buildJob = async {
    if (buildTasks.isNotEmpty()) {
      runBuildLauncher(
          connection,
          buildTasks.associate { it.key to it.value },
          args,
          excludeTasks,
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
          excludeTestTasks,
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
    excludeTasks: List<String>,
    outputStream: ByteArrayOutputStream,
    errorStream: ByteArrayOutputStream
): Map<String, TaskResult> {
  val taskNames = tasks.values.map { it.taskName }.distinct().toTypedArray()
  logger.info("📋 Collected ${taskNames.size} unique task names: ${taskNames.joinToString(", ")}")

  val taskStartTimes = mutableMapOf<String, Long>()
  val taskResults = mutableMapOf<String, TaskResult>()

  val globalStart = System.currentTimeMillis()
  var globalOutput: String

  val excludeArgs = excludeTasks.map { "--exclude-task=$it" }

  try {
    connection
        .newBuild()
        .apply {
          forTasks(*taskNames)
          addArguments(*(args + excludeArgs).toTypedArray())
          setStandardOutput(outputStream)
          setStandardError(errorStream)
          withDetailedFailure()
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
  val maxEndTime = taskResults.values.map { it.endTime }.maxOrNull() ?: globalEnd
  val delta = globalEnd - maxEndTime
  logger.info("build delta $delta")

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
    excludeTestTasks: List<String>,
    outputStream: ByteArrayOutputStream,
    errorStream: ByteArrayOutputStream
): Map<String, TaskResult> {
  val testTaskStatus = mutableMapOf<String, Boolean>()
  val testStartTimes = mutableMapOf<String, Long>()
  val testEndTimes = mutableMapOf<String, Long>()

  // Group the list of GradleTask by their taskName
  val groupedTasks: Map<String, List<GradleTask>> = tasks.values.groupBy { it.taskName }
  logger.info("📋 Collected ${groupedTasks.keys.size} unique task names: $groupedTasks")

  val globalStart = System.currentTimeMillis()
  var globalOutput: String
  val eventTypes: MutableSet<OperationType> = HashSet()
  eventTypes.add(OperationType.TASK)
  eventTypes.add(OperationType.TEST)

  val excludeArgs = excludeTestTasks.flatMap { listOf("--exclude-task", it) }
  logger.info("excludeTestTasks $excludeArgs")

  try {
    connection
        .newTestLauncher()
        .apply {
          groupedTasks.forEach { withTaskAndTestClasses(it.key, it.value.map { it.testClassName }) }
          addArguments("-Djunit.jupiter.execution.parallel.enabled=true") // Add JUnit 5 parallelism
          // arguments here
          addArguments(
              *(args + excludeArgs).toTypedArray()) // Combine your existing args with JUnit args
          setStandardOutput(outputStream)
          setStandardError(errorStream)
          addProgressListener(
              testListener(tasks, testTaskStatus, testStartTimes, testEndTimes), eventTypes)
          withDetailedFailure()
        }
        .run()
    globalOutput = buildTerminalOutput(outputStream, errorStream)
  } catch (e: BuildCancelledException) {
    globalOutput = buildTerminalOutput(outputStream, errorStream)
    logger.info("✅ Build cancelled gracefully by token.")
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
  val maxEndTime = testEndTimes.values.maxOrNull() ?: globalEnd
  val delta = globalEnd - maxEndTime
  logger.info("test delta $delta")

  val taskResults = mutableMapOf<String, TaskResult>()
  tasks.forEach { (nxTaskId, taskConfig) ->
    if (taskConfig.testClassName != null) {
      val success = testTaskStatus[nxTaskId] ?: false
      val startTime = testStartTimes[nxTaskId] ?: globalStart
      val endTime = testEndTimes[nxTaskId] ?: globalEnd

      taskResults[nxTaskId] = TaskResult(success, startTime, endTime, "")
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
