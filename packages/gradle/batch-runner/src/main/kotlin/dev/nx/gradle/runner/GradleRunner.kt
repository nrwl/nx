package dev.nx.gradle.runner

import dev.nx.gradle.data.GradleTask
import dev.nx.gradle.data.TaskResult
import dev.nx.gradle.util.logger
import java.io.ByteArrayOutputStream
import java.util.concurrent.ConcurrentHashMap
import org.gradle.tooling.BuildCancelledException
import org.gradle.tooling.ProjectConnection
import org.gradle.tooling.events.OperationType

fun runTasksInParallel(
    connection: ProjectConnection,
    tasks: Map<String, GradleTask>,
    additionalArgs: String,
    excludeTasks: List<String>,
    excludeTestTasks: List<String>
): Map<String, TaskResult> {
  logger.info("▶️ Running all tasks in a single Gradle run: ${tasks.keys.joinToString(", ")}")

  val (testClassTasks, buildTasks) = tasks.entries.partition { it.value.testClassName != null }

  logger.info("🧪 Test launcher tasks: ${testClassTasks.joinToString(", ") { it.key }}")
  logger.info("🛠️ Build launcher tasks: ${buildTasks.joinToString(", ") { it.key }}")

  val outputStream1 = ByteArrayOutputStream()
  val errorStream1 = ByteArrayOutputStream()
  val outputStream2 = ByteArrayOutputStream()
  val errorStream2 = ByteArrayOutputStream()

  // --continue is for continue running tasks if one failed in a batch
  // --parallel is for performance
  // -Dorg.gradle.daemon.idletimeout=0 is to kill daemon after 0 ms
  val cpuCores = Runtime.getRuntime().availableProcessors()
  val workersMax = (cpuCores * 0.5).toInt().coerceAtLeast(1)
  val args =
      mutableListOf(
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

  val allResults = mutableMapOf<String, TaskResult>()

  if (buildTasks.isNotEmpty()) {
    val buildResults =
        runBuildLauncher(
            connection,
            buildTasks.associate { it.key to it.value },
            args,
            excludeTasks,
            outputStream1,
            errorStream1)
    allResults.putAll(buildResults)
  }

  if (testClassTasks.isNotEmpty()) {
    val testResults =
        runTestLauncher(
            connection,
            testClassTasks.associate { it.key to it.value },
            args,
            excludeTestTasks,
            outputStream2,
            errorStream2)
    allResults.putAll(testResults)
  }

  return allResults
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
  val taskResults = ConcurrentHashMap<String, TaskResult>()
  // Gradle task path -> Nx task id, awaiting an emit. Drained by buildListener on TaskStartEvent
  // and finally below at end-of-build.
  val pendingEmit = ConcurrentHashMap<String, String>()

  val globalStart = System.currentTimeMillis()

  val excludeArgs = excludeTasks.map { "--exclude-task=$it" }

  fun emitForTaskPath(taskPath: String, capturedOutput: String) {
    val nxTaskId = pendingEmit.remove(taskPath) ?: return
    val existing = taskResults[nxTaskId] ?: return
    val updated = existing.copy(terminalOutput = capturedOutput)
    taskResults[nxTaskId] = updated
    ResultEmitter.emit(nxTaskId, updated)
  }

  // Per-task slicing happens at write time: each byte gets routed into capture's per-task buffer
  // based on the most recent `> Task :foo:bar` header, so per-task lookups are O(own size).
  val capture = TaskOutputCapture(System.err)

  try {
    connection
        .newBuild()
        .apply {
          forTasks(*taskNames)
          addArguments(*(args + excludeArgs).toTypedArray())
          setStandardOutput(TeeOutputStream(outputStream, capture))
          setStandardError(TeeOutputStream(errorStream, capture.errorSink()))
          withDetailedFailure()
          addProgressListener(
              buildListener(
                  tasks, taskStartTimes, taskResults, pendingEmit, capture, ::emitForTaskPath),
              OperationType.TASK)
        }
        .run()
  } catch (e: Exception) {
    logger.warning("\ud83d\udca5 Gradle run failed: ${e.message} $errorStream")
  } finally {
    outputStream.close()
    errorStream.close()
  }

  // The last task has no successor TaskStartEvent to drain it; flush here.
  pendingEmit.keys.toList().forEach { taskPath ->
    emitForTaskPath(taskPath, capture.getOutput(taskPath))
  }

  val globalEnd = System.currentTimeMillis()
  taskResults.putAll(
      emitSkippedForUnreachedTasks(
          requestedNxTaskIds = tasks.keys,
          reportedNxTaskIds = taskResults.keys,
          startTime = globalStart,
          endTime = globalEnd,
      ))
  val maxEndTime = taskResults.values.map { it.endTime }.maxOrNull() ?: globalEnd
  val minStartTime = taskResults.values.map { it.startTime }.minOrNull() ?: globalStart
  logger.info(
      "⏱️ Build start timing gap: ${minStartTime - globalStart}ms (time between first task start and build launcher start) ")
  logger.info(
      "⏱️ Build completion timing gap: ${globalEnd - maxEndTime}ms (time between last task finish and build end)")

  logger.info("\u2705 Finished build tasks")
  return taskResults
}

private fun emitSkippedForUnreachedTasks(
    requestedNxTaskIds: Set<String>,
    reportedNxTaskIds: Set<String>,
    startTime: Long,
    endTime: Long,
): Map<String, TaskResult> {
  val skippedResults = mutableMapOf<String, TaskResult>()
  requestedNxTaskIds.forEach { nxTaskId ->
    if (nxTaskId !in reportedNxTaskIds) {
      val skipped = TaskResult.skipped(startTime, endTime)
      skippedResults[nxTaskId] = skipped
      ResultEmitter.emit(nxTaskId, skipped)
    }
  }
  return skippedResults
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
  val eventTypes: MutableSet<OperationType> = HashSet()
  eventTypes.add(OperationType.TASK)
  eventTypes.add(OperationType.TEST)

  val excludeArgs = excludeTestTasks.flatMap { listOf("--exclude-task", it) }
  logger.info("excludeTestTasks $excludeArgs")

  // Multiple Nx tasks (one per test class) can share a single Gradle test task path; they end
  // up with the same captured section since TAPI doesn't slice stdout by test class.
  val capture = TaskOutputCapture(System.err)

  fun normalizedTaskPath(nxTaskId: String): String? =
      tasks[nxTaskId]?.taskName?.let { ":${normalizeTaskPath(it)}" }

  fun capturedFor(nxTaskId: String): String =
      normalizedTaskPath(nxTaskId)?.let { capture.getOutput(it) } ?: ""

  val emittedNxTasks = ConcurrentHashMap.newKeySet<String>()

  val emitTestTask: (String) -> Unit = { nxTaskId ->
    val captured = capturedFor(nxTaskId)
    // Skip empty captures; they'll be retried on later events or the end-of-runTestLauncher sweep.
    if (captured.isNotEmpty() && emittedNxTasks.add(nxTaskId)) {
      val success = testTaskStatus[nxTaskId] ?: false
      val startTime = testStartTimes[nxTaskId] ?: globalStart
      val endTime = testEndTimes[nxTaskId] ?: System.currentTimeMillis()
      ResultEmitter.emit(nxTaskId, TaskResult.fromBoolean(success, startTime, endTime, captured))
    }
  }

  try {
    connection
        .newTestLauncher()
        .apply {
          groupedTasks.forEach { withTaskAndTestClasses(it.key, it.value.map { it.testClassName }) }
          addArguments("-Djunit.jupiter.execution.parallel.enabled=true") // Add JUnit 5 parallelism
          // arguments here
          addArguments(
              *(args + excludeArgs).toTypedArray()) // Combine your existing args with JUnit args
          setStandardOutput(TeeOutputStream(outputStream, capture))
          setStandardError(TeeOutputStream(errorStream, capture.errorSink()))
          addProgressListener(
              testListener(tasks, testTaskStatus, testStartTimes, testEndTimes, emitTestTask),
              eventTypes)
          withDetailedFailure()
        }
        .run()
  } catch (e: BuildCancelledException) {
    logger.info("✅ Build cancelled gracefully by token.")
  } catch (e: Exception) {
    logger.warning(errorStream.toString())
    logger.warning("\ud83d\udca5 Gradle test run failed: ${e.message} $errorStream")
  } finally {
    outputStream.close()
    errorStream.close()
  }

  val globalEnd = System.currentTimeMillis()
  val maxEndTime = testEndTimes.values.maxOrNull() ?: globalEnd
  val minStartTime = testStartTimes.values.minOrNull() ?: globalStart
  logger.info(
      "⏱️ Test start timing gap: ${minStartTime - globalStart}ms (time between first test start and test launcher start) ")
  logger.info(
      "⏱️ Test completion timing gap: ${globalEnd - maxEndTime}ms (time between last test finish and test launcher end)")

  val taskResults = mutableMapOf<String, TaskResult>()
  tasks.forEach { (nxTaskId, taskConfig) ->
    if (taskConfig.testClassName != null) {
      val ranTask = testTaskStatus.containsKey(nxTaskId)
      val success = testTaskStatus[nxTaskId] ?: false
      val startTime = testStartTimes[nxTaskId] ?: globalStart
      val endTime = testEndTimes[nxTaskId] ?: globalEnd
      // No test events fired → mark as skipped (peer compile failed, etc.) rather than failure.
      val result =
          if (!ranTask) TaskResult.skipped(startTime, endTime)
          else TaskResult.fromBoolean(success, startTime, endTime, capturedFor(nxTaskId))
      taskResults[nxTaskId] = result
      // ResultEmitter dedupes by task id; this catches tests whose captured output was empty
      // when emitTestTask fired during the build.
      ResultEmitter.emit(nxTaskId, result)
    }
  }

  logger.info("\u2705 Finished test tasks")
  return taskResults
}
