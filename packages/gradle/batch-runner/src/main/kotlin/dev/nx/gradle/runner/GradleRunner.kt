package dev.nx.gradle.runner

import dev.nx.gradle.data.GradleTask
import dev.nx.gradle.data.TaskResult
import dev.nx.gradle.runner.OutputProcessor.buildTerminalOutput
import dev.nx.gradle.runner.OutputProcessor.finalizeTaskResults
import dev.nx.gradle.runner.OutputProcessor.splitOutputPerTask
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
  // Tasks whose TaskFinishEvent fired but whose stdout hasn't been emitted yet.
  // Keyed by Gradle task path, value is the Nx task id. The buildListener drains entries
  // on each TaskStartEvent (gated on having any captured bytes for the task); anything
  // still pending at end-of-build is flushed below.
  val pendingEmit = ConcurrentHashMap<String, String>()

  val globalStart = System.currentTimeMillis()
  var globalOutput: String

  val excludeArgs = excludeTasks.map { "--exclude-task=$it" }

  fun emitForTaskPath(taskPath: String, capturedOutput: String) {
    val nxTaskId = pendingEmit.remove(taskPath) ?: return
    val existing = taskResults[nxTaskId] ?: return
    val updated = existing.copy(terminalOutput = capturedOutput)
    taskResults[nxTaskId] = updated
    ResultEmitter.emit(nxTaskId, updated)
  }

  try {
    connection
        .newBuild()
        .apply {
          forTasks(*taskNames)
          addArguments(*(args + excludeArgs).toTypedArray())
          // Tee Gradle's stdout into our buffered outputStream (for splitOutputPerTask) and
          // System.err (so users see the build output live in their terminal).
          setStandardOutput(TeeOutputStream(outputStream, System.err))
          setStandardError(TeeOutputStream(errorStream, System.err))
          withDetailedFailure()
          addProgressListener(
              buildListener(
                  tasks,
                  taskStartTimes,
                  taskResults,
                  pendingEmit,
                  outputStream,
                  ::emitForTaskPath),
              OperationType.TASK)
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

  // Flush any tasks the listener-thread drain didn't catch — typically the last task in the
  // build (no successor TaskStartEvent fires) and any tasks whose bytes hadn't reached our
  // stream yet at the time their successor's TaskStartEvent fired.
  val finalSections = splitOutputPerTask(globalOutput)
  pendingEmit.keys.toList().forEach { taskPath ->
    emitForTaskPath(taskPath, finalSections[taskPath] ?: "")
  }

  val globalEnd = System.currentTimeMillis()
  val maxEndTime = taskResults.values.map { it.endTime }.maxOrNull() ?: globalEnd
  val minStartTime = taskResults.values.map { it.startTime }.minOrNull() ?: globalStart
  logger.info(
      "⏱️ Build start timing gap: ${minStartTime - globalStart}ms (time between first task start and build launcher start) ")
  logger.info(
      "⏱️ Build completion timing gap: ${globalEnd - maxEndTime}ms (time between last task finish and build end)")

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

  // TestLauncher routes test stdout through setStandardOutput (it diverts it to
  // TestOutputEvents only when OperationType.TEST_OUTPUT is subscribed), so we slice the
  // captured streams by Gradle task path via splitOutputPerTask at emit time. Multiple Nx
  // tasks under the same Gradle test task share the same section.
  fun normalizedTaskPath(nxTaskId: String): String? =
      tasks[nxTaskId]?.taskName?.let { ":${normalizeTaskPath(it)}" }

  fun capturedFor(nxTaskId: String): String =
      normalizedTaskPath(nxTaskId)?.let { taskPath ->
        val out = splitOutputPerTask(outputStream.toString("UTF-8"))[taskPath].orEmpty()
        val err = splitOutputPerTask(errorStream.toString("UTF-8"))[taskPath].orEmpty()
        listOf(out, err).filter { it.isNotBlank() }.joinToString("\n")
      } ?: ""

  // Tracks which nxTaskIds we've already streamed so the listener-thread retries are idempotent.
  // `add` returns true iff newly inserted, so we use it to atomically claim emission.
  val emittedNxTasks = ConcurrentHashMap.newKeySet<String>()

  val emitTestTask: (String) -> Unit = { nxTaskId ->
    val captured = capturedFor(nxTaskId)
    // Buffer-state guard: skip if (a) the Gradle test task's bytes haven't reached our stream
    // yet, or (b) we already emitted for this nxTaskId. Parked tasks will be retried on later
    // events (other classes' TestFinishEvent, the test task's TaskFinishEvent safety net) and
    // finally by the end-of-runTestLauncher sweep, by which time output has been flushed.
    if (captured.isNotEmpty() && emittedNxTasks.add(nxTaskId)) {
      val success = testTaskStatus[nxTaskId] ?: false
      val startTime = testStartTimes[nxTaskId] ?: globalStart
      val endTime = testEndTimes[nxTaskId] ?: System.currentTimeMillis()
      ResultEmitter.emit(nxTaskId, TaskResult(success, startTime, endTime, captured))
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
          setStandardOutput(TeeOutputStream(outputStream, System.err))
          setStandardError(TeeOutputStream(errorStream, System.err))
          addProgressListener(
              testListener(tasks, testTaskStatus, testStartTimes, testEndTimes, emitTestTask),
              eventTypes)
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
  val minStartTime = testStartTimes.values.minOrNull() ?: globalStart
  logger.info(
      "⏱️ Test start timing gap: ${minStartTime - globalStart}ms (time between first test start and test launcher start) ")
  logger.info(
      "⏱️ Test completion timing gap: ${globalEnd - maxEndTime}ms (time between last test finish and test launcher end)")

  val taskResults = mutableMapOf<String, TaskResult>()
  tasks.forEach { (nxTaskId, taskConfig) ->
    if (taskConfig.testClassName != null) {
      val success = testTaskStatus[nxTaskId] ?: false
      val startTime = testStartTimes[nxTaskId] ?: globalStart
      val endTime = testEndTimes[nxTaskId] ?: globalEnd
      taskResults[nxTaskId] = TaskResult(success, startTime, endTime, capturedFor(nxTaskId))
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
