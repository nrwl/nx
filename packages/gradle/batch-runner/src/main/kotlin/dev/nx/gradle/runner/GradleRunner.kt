package dev.nx.gradle.runner

import com.google.gson.Gson
import dev.nx.gradle.data.GradleTask
import dev.nx.gradle.data.TaskResult
import dev.nx.gradle.util.logger
import java.io.ByteArrayOutputStream
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicReference
import org.gradle.tooling.BuildCancelledException
import org.gradle.tooling.ProjectConnection
import org.gradle.tooling.events.OperationType
import org.gradle.tooling.events.ProgressEvent
import org.gradle.tooling.events.task.TaskFailureResult
import org.gradle.tooling.events.task.TaskFinishEvent
import org.gradle.tooling.events.task.TaskStartEvent
import org.gradle.tooling.events.task.TaskSuccessResult
import org.gradle.tooling.events.test.*

private val gson = Gson()

/**
 * Normalizes a Gradle task path by removing the leading colon. Gradle events use paths like
 * `:project:task` but Nx uses `project:task`.
 */
private fun normalizeTaskPath(taskPath: String): String = taskPath.trimStart(':')

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

  // --info is for terminal per task
  // --continue is for continue running tasks if one failed in a batch
  // --parallel is for performance
  // -Dorg.gradle.daemon.idletimeout=0 is to kill daemon after 0 ms
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

  val allResults = ConcurrentHashMap<String, TaskResult>()

  if (buildTasks.isNotEmpty()) {
    val buildResults =
        runBuildLauncher(
            connection, buildTasks.associate { it.key to it.value }, args, excludeTasks)
    allResults.putAll(buildResults)
  }

  if (testClassTasks.isNotEmpty()) {
    val testResults =
        runTestLauncher(
            connection, testClassTasks.associate { it.key to it.value }, args, excludeTestTasks)
    allResults.putAll(testResults)
  }

  return allResults.toMap()
}

fun runBuildLauncher(
    connection: ProjectConnection,
    tasks: Map<String, GradleTask>,
    args: List<String>,
    excludeTasks: List<String>
): Map<String, TaskResult> {
  val taskNames = tasks.values.map { it.taskName }.distinct().toTypedArray()
  logger.info("📋 Collected ${taskNames.size} unique task names: ${taskNames.joinToString(", ")}")

  val taskStartTimes = ConcurrentHashMap<String, Long>()
  val taskResults = ConcurrentHashMap<String, TaskResult>()
  val taskOutputBuffers = ConcurrentHashMap<String, StringBuilder>()

  // Track current task for output attribution
  val currentTaskRef = AtomicReference<String?>(null)

  val globalStart = System.currentTimeMillis()
  val errorStream = ByteArrayOutputStream()

  val excludeArgs = excludeTasks.map { "--exclude-task=$it" }

  // Create a TeeOutputStream that:
  // 1. Forwards to System.out (real-time terminal output)
  // 2. Buffers per-task output for result emission
  val teeOutputStream =
      TeeOutputStream(System.out) { line ->
        // Detect task headers and attribute output
        val taskMatch = Regex("> Task (:[^\\s]+)").find(line)
        if (taskMatch != null) {
          val gradleTaskName = taskMatch.groupValues[1]
          // Find the Nx task ID for this Gradle task
          val nxTaskId =
              tasks.entries
                  .find {
                    normalizeTaskPath(it.value.taskName) == normalizeTaskPath(gradleTaskName)
                  }
                  ?.key
          currentTaskRef.set(nxTaskId)
          nxTaskId?.let { taskOutputBuffers.getOrPut(it) { StringBuilder() } }
        }

        // Append line to current task's buffer
        currentTaskRef.get()?.let { taskId ->
          taskOutputBuffers.getOrPut(taskId) { StringBuilder() }.appendLine(line)
        }
      }

  try {
    connection
        .newBuild()
        .apply {
          forTasks(*taskNames)
          addArguments(*(args + excludeArgs).toTypedArray())
          setStandardOutput(teeOutputStream)
          setStandardError(errorStream)
          withDetailedFailure()
          addProgressListener(
              streamingBuildListener(tasks, taskStartTimes, taskResults, taskOutputBuffers),
              OperationType.TASK)
        }
        .run()
  } catch (e: Exception) {
    logger.warning("\uD83D\uDCA5 Gradle run failed: ${e.message}")
    // Emit failures for any tasks that didn't complete
    emitFailuresForIncompleteTasks(
        tasks, taskResults, taskStartTimes, taskOutputBuffers, e.message ?: "Unknown error")
  } finally {
    teeOutputStream.close()
    errorStream.close()
  }

  val globalEnd = System.currentTimeMillis()
  val maxEndTime = taskResults.values.map { it.endTime }.maxOrNull() ?: globalEnd
  val minStartTime = taskResults.values.map { it.startTime }.minOrNull() ?: globalStart
  logger.info(
      "⏱️ Build start timing gap: ${minStartTime - globalStart}ms (time between first task start and build launcher start) ")
  logger.info(
      "⏱️ Build completion timing gap: ${globalEnd - maxEndTime}ms (time between last task finish and build end)")

  logger.info("\u2705 Finished build tasks")
  return taskResults.toMap()
}

fun runTestLauncher(
    connection: ProjectConnection,
    tasks: Map<String, GradleTask>,
    args: List<String>,
    excludeTestTasks: List<String>
): Map<String, TaskResult> {
  val testTaskStatus = ConcurrentHashMap<String, Boolean>()
  val testStartTimes = ConcurrentHashMap<String, Long>()
  val testEndTimes = ConcurrentHashMap<String, Long>()
  val taskOutputBuffers = ConcurrentHashMap<String, StringBuilder>()
  val taskResults = ConcurrentHashMap<String, TaskResult>()

  // Track current task for output attribution
  val currentTaskRef = AtomicReference<String?>(null)

  // Group the list of GradleTask by their taskName
  val groupedTasks: Map<String, List<GradleTask>> = tasks.values.groupBy { it.taskName }
  logger.info("📋 Collected ${groupedTasks.keys.size} unique task names: $groupedTasks")

  val globalStart = System.currentTimeMillis()
  val errorStream = ByteArrayOutputStream()
  val eventTypes: MutableSet<OperationType> = HashSet()
  eventTypes.add(OperationType.TASK)
  eventTypes.add(OperationType.TEST)

  val excludeArgs = excludeTestTasks.flatMap { listOf("--exclude-task", it) }
  logger.info("excludeTestTasks $excludeArgs")

  // Create a TeeOutputStream for real-time output
  val teeOutputStream =
      TeeOutputStream(System.out) { line ->
        // Detect task headers and attribute output
        val taskMatch = Regex("> Task (:[^\\s]+)").find(line)
        if (taskMatch != null) {
          val gradleTaskName = taskMatch.groupValues[1]
          // For test tasks, we may have multiple Nx tasks per Gradle task
          // Find all matching Nx task IDs
          val matchingTasks =
              tasks.entries.filter {
                normalizeTaskPath(it.value.taskName) == normalizeTaskPath(gradleTaskName)
              }
          if (matchingTasks.isNotEmpty()) {
            // Use the first matching task as current (output will be duplicated to all matching
            // tasks)
            currentTaskRef.set(matchingTasks.first().key)
            matchingTasks.forEach { (taskId, _) ->
              taskOutputBuffers.getOrPut(taskId) { StringBuilder() }
            }
          }
        }

        // Append line to all matching test task buffers
        currentTaskRef.get()?.let { primaryTaskId ->
          val gradleTaskName = tasks[primaryTaskId]?.taskName
          if (gradleTaskName != null) {
            tasks.entries
                .filter {
                  normalizeTaskPath(it.value.taskName) == normalizeTaskPath(gradleTaskName)
                }
                .forEach { (taskId, _) ->
                  taskOutputBuffers.getOrPut(taskId) { StringBuilder() }.appendLine(line)
                }
          }
        }
      }

  try {
    connection
        .newTestLauncher()
        .apply {
          groupedTasks.forEach { withTaskAndTestClasses(it.key, it.value.map { it.testClassName }) }
          addArguments("-Djunit.jupiter.execution.parallel.enabled=true")
          addArguments(*(args + excludeArgs).toTypedArray())
          setStandardOutput(teeOutputStream)
          setStandardError(errorStream)
          addProgressListener(
              streamingTestListener(
                  tasks,
                  testTaskStatus,
                  testStartTimes,
                  testEndTimes,
                  taskOutputBuffers,
                  taskResults),
              eventTypes)
          withDetailedFailure()
        }
        .run()
  } catch (e: BuildCancelledException) {
    logger.info("✅ Build cancelled gracefully by token.")
  } catch (e: Exception) {
    logger.warning("\uD83D\uDCA5 Gradle test run failed: ${e.message}")
    // Emit failures for any tasks that didn't complete
    emitFailuresForIncompleteTestTasks(
        tasks, taskResults, testStartTimes, taskOutputBuffers, e.message ?: "Unknown error")
  } finally {
    teeOutputStream.close()
    errorStream.close()
  }

  val globalEnd = System.currentTimeMillis()
  val maxEndTime = testEndTimes.values.maxOrNull() ?: globalEnd
  val minStartTime = testStartTimes.values.minOrNull() ?: globalStart
  logger.info(
      "⏱️ Test start timing gap: ${minStartTime - globalStart}ms (time between first test start and test launcher start) ")
  logger.info(
      "⏱️ Test completion timing gap: ${globalEnd - maxEndTime}ms (time between last test finish and test launcher end)")

  logger.info("\u2705 Finished test tasks")
  return taskResults.toMap()
}

/** Progress listener that emits NX_RESULT to stderr when build tasks complete. */
private fun streamingBuildListener(
    tasks: Map<String, GradleTask>,
    taskStartTimes: ConcurrentHashMap<String, Long>,
    taskResults: ConcurrentHashMap<String, TaskResult>,
    taskOutputBuffers: ConcurrentHashMap<String, StringBuilder>
): (ProgressEvent) -> Unit = { event ->
  when (event) {
    is TaskStartEvent -> {
      val taskPath = event.descriptor.taskPath
      tasks.entries
          .find { normalizeTaskPath(it.value.taskName) == normalizeTaskPath(taskPath) }
          ?.key
          ?.let { nxTaskId ->
            taskStartTimes[nxTaskId] = event.eventTime
            logger.info("🏁 Task start: $nxTaskId $taskPath")
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
          .find { normalizeTaskPath(it.value.taskName) == normalizeTaskPath(taskPath) }
          ?.key
          ?.let { nxTaskId ->
            val endTime = event.result.endTime
            val startTime = taskStartTimes[nxTaskId] ?: event.result.startTime
            val output = taskOutputBuffers[nxTaskId]?.toString() ?: ""

            val result = TaskResult(success, startTime, endTime, output)
            taskResults[nxTaskId] = result

            // Emit result to stderr immediately
            emitResult(nxTaskId, result)
          }
    }
  }
}

/** Progress listener that emits NX_RESULT to stderr when test tasks complete. */
private fun streamingTestListener(
    tasks: Map<String, GradleTask>,
    testTaskStatus: ConcurrentHashMap<String, Boolean>,
    testStartTimes: ConcurrentHashMap<String, Long>,
    testEndTimes: ConcurrentHashMap<String, Long>,
    taskOutputBuffers: ConcurrentHashMap<String, StringBuilder>,
    taskResults: ConcurrentHashMap<String, TaskResult>
): (ProgressEvent) -> Unit = { event ->
  when (event) {
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
          .filter { normalizeTaskPath(it.value.taskName) == normalizeTaskPath(taskPath) }
          .forEach { (nxTaskId, _) ->
            testTaskStatus.computeIfAbsent(nxTaskId) { success }
            testEndTimes.computeIfAbsent(nxTaskId) { event.result.endTime }
          }
    }

    is TestStartEvent -> {
      val descriptor = event.descriptor as? JvmTestOperationDescriptor
      descriptor?.className?.let { className ->
        tasks.entries
            .find { (_, v) -> v.testClassName == className }
            ?.key
            ?.let { nxTaskId ->
              testStartTimes.computeIfAbsent(nxTaskId) { event.eventTime }
              logger.info("🏁 Test start: $nxTaskId $className")
            }
      }
    }

    is TestFinishEvent -> {
      val descriptor = event.descriptor as? JvmTestOperationDescriptor
      val nxTaskId =
          descriptor?.className?.let { className ->
            tasks.entries.find { (_, v) -> v.testClassName == className }?.key
          }

      nxTaskId?.let { taskId ->
        testEndTimes[taskId] = event.result.endTime
        val name = descriptor?.className ?: "unknown"

        val success =
            when (event.result) {
              is TestSuccessResult -> {
                testTaskStatus[taskId] = true
                logger.info("✅ Test passed: $taskId $name")
                true
              }
              is TestFailureResult -> {
                testTaskStatus[taskId] = false
                logger.warning("❌ Test failed: $taskId $name")
                false
              }
              is TestSkippedResult -> {
                testTaskStatus[taskId] = true
                logger.warning("⚠️ Test skipped: $taskId $name")
                true
              }
              else -> {
                testTaskStatus[taskId] = true
                logger.warning("⚠️ Unknown test result: $taskId $name")
                true
              }
            }

        val startTime = testStartTimes[taskId] ?: event.result.startTime
        val endTime = event.result.endTime
        val output = taskOutputBuffers[taskId]?.toString() ?: ""

        val result = TaskResult(success, startTime, endTime, output)
        taskResults[taskId] = result

        // Emit result to stderr immediately
        emitResult(taskId, result)
      }
    }
  }
}

/**
 * Emit a task result to stderr as JSON for streaming to Nx. Format:
 * NX_RESULT:{"task":"taskId","result":{...}}
 */
private fun emitResult(taskId: String, result: TaskResult) {
  val resultData =
      mapOf(
          "task" to taskId,
          "result" to
              mapOf(
                  "success" to result.success,
                  "terminalOutput" to result.terminalOutput,
                  "startTime" to result.startTime,
                  "endTime" to result.endTime))
  val json = gson.toJson(resultData)
  System.err.println("NX_RESULT:$json")
  System.err.flush()
}

/** Emit failures for any build tasks that didn't complete when an exception occurs. */
private fun emitFailuresForIncompleteTasks(
    tasks: Map<String, GradleTask>,
    taskResults: ConcurrentHashMap<String, TaskResult>,
    taskStartTimes: ConcurrentHashMap<String, Long>,
    taskOutputBuffers: ConcurrentHashMap<String, StringBuilder>,
    errorMessage: String
) {
  val currentTime = System.currentTimeMillis()
  tasks.forEach { (taskId, _) ->
    if (!taskResults.containsKey(taskId)) {
      val startTime = taskStartTimes[taskId] ?: currentTime
      val output = taskOutputBuffers[taskId]?.toString() ?: ""
      val result =
          TaskResult(
              success = false,
              startTime = startTime,
              endTime = currentTime,
              terminalOutput = "$output\nException occurred: $errorMessage")
      taskResults[taskId] = result
      emitResult(taskId, result)
    }
  }
}

/** Emit failures for any test tasks that didn't complete when an exception occurs. */
private fun emitFailuresForIncompleteTestTasks(
    tasks: Map<String, GradleTask>,
    taskResults: ConcurrentHashMap<String, TaskResult>,
    testStartTimes: ConcurrentHashMap<String, Long>,
    taskOutputBuffers: ConcurrentHashMap<String, StringBuilder>,
    errorMessage: String
) {
  val currentTime = System.currentTimeMillis()
  tasks.forEach { (taskId, _) ->
    if (!taskResults.containsKey(taskId)) {
      val startTime = testStartTimes[taskId] ?: currentTime
      val output = taskOutputBuffers[taskId]?.toString() ?: ""
      val result =
          TaskResult(
              success = false,
              startTime = startTime,
              endTime = currentTime,
              terminalOutput = "$output\nException occurred: $errorMessage")
      taskResults[taskId] = result
      emitResult(taskId, result)
    }
  }
}
