package dev.nx.gradle.runner

import com.google.gson.Gson
import dev.nx.gradle.data.GradleTask
import dev.nx.gradle.data.NxTaskGraph
import dev.nx.gradle.data.TaskResult
import dev.nx.gradle.util.logger
import dev.nx.gradle.util.removeTasksFromTaskGraph
import java.io.ByteArrayOutputStream
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.LinkedBlockingQueue
import org.gradle.tooling.ProjectConnection

private val gson = Gson()

/**
 * Runs tasks using per-task Gradle invocations with a work-stealing queue driven by the Nx task
 * graph. Each task gets its own Gradle invocation with isolated output streams — no output
 * attribution problems by design.
 */
fun runTasksWithGraph(
    connection: ProjectConnection,
    tasks: Map<String, GradleTask>,
    taskGraph: NxTaskGraph,
    additionalArgs: String,
    excludeTasks: List<String>,
    excludeTestTasks: List<String>
): Map<String, TaskResult> {
  logger.info("Running ${tasks.size} tasks with per-task invocations")

  val cpuCores = Runtime.getRuntime().availableProcessors()
  val numWorkers = (cpuCores * 0.5).toInt().coerceAtLeast(1)
  logger.info("Using $numWorkers worker threads (from $cpuCores CPU cores)")

  val args = buildArgs(additionalArgs)
  logger.info("Args: ${args.joinToString(", ")}")

  val allResults = ConcurrentHashMap<String, TaskResult>()
  val latch = CountDownLatch(tasks.size)

  // Mutable graph state — protected by synchronization on graphLock
  val graphLock = Any()
  var currentGraph = taskGraph

  // Work queue seeded with initial roots
  val workQueue = LinkedBlockingQueue<String>()
  taskGraph.roots.forEach { workQueue.put(it) }

  val executor = Executors.newFixedThreadPool(numWorkers)

  // Launch workers
  for (i in 0 until numWorkers) {
    executor.submit {
      while (true) {
        // Poll with a timeout to allow workers to exit when done
        val taskId = workQueue.poll(500, java.util.concurrent.TimeUnit.MILLISECONDS)
        if (taskId == null) {
          // Check if we're done — all tasks counted down
          if (latch.count == 0L) break
          continue
        }

        val task = tasks[taskId]
        if (task == null) {
          logger.warning("Task $taskId not found in tasks map, skipping")
          latch.countDown()
          continue
        }

        logger.info("Executing task: $taskId (${task.taskName})")
        val result =
            executeSingleTask(connection, taskId, task, args, excludeTasks, excludeTestTasks)
        allResults[taskId] = result
        emitResult(taskId, result)

        // Update graph and enqueue newly unblocked tasks
        val completedIds = listOf(taskId)
        val failedIds = if (result.success) emptyList() else listOf(taskId)

        synchronized(graphLock) {
          val (newGraph, skippedTasks) =
              removeTasksFromTaskGraph(currentGraph, completedIds, failedIds)
          currentGraph = newGraph

          // Emit skip results for tasks that will never run
          for (skippedId in skippedTasks) {
            if (!allResults.containsKey(skippedId)) {
              val skipResult =
                  TaskResult(
                      success = false,
                      startTime = System.currentTimeMillis(),
                      endTime = System.currentTimeMillis(),
                      terminalOutput = "Skipped: dependency task '$taskId' failed")
              allResults[skippedId] = skipResult
              emitResult(skippedId, skipResult)
              latch.countDown()
            }
          }

          // Enqueue newly available roots
          for (root in newGraph.roots) {
            if (!allResults.containsKey(root)) {
              workQueue.put(root)
            }
          }
        }

        latch.countDown()
      }
    }
  }

  // Wait for all tasks to complete
  latch.await()
  executor.shutdown()

  val summary = allResults.values.groupBy { it.success }
  logger.info(
      "Finished: ${summary[true]?.size ?: 0} succeeded, ${summary[false]?.size ?: 0} failed")

  return allResults.toMap()
}

/**
 * Executes a single Gradle task as its own invocation. Captures stdout and stderr independently for
 * clean output isolation.
 */
private fun executeSingleTask(
    connection: ProjectConnection,
    taskId: String,
    task: GradleTask,
    args: List<String>,
    excludeTasks: List<String>,
    excludeTestTasks: List<String>
): TaskResult {
  val stdoutCapture = ByteArrayOutputStream()
  val stderrCapture = ByteArrayOutputStream()
  val teeStdout = TeeOutputStream(System.out, stdoutCapture)
  val teeStderr = TeeOutputStream(System.err, stderrCapture)

  val startTime = System.currentTimeMillis()

  try {
    if (task.testClassName != null) {
      // Test task — use TestLauncher
      val excludeArgs = excludeTestTasks.flatMap { listOf("--exclude-task", it) }
      connection
          .newTestLauncher()
          .apply {
            withTaskAndTestClasses(task.taskName, listOf(task.testClassName))
            addArguments("-Djunit.jupiter.execution.parallel.enabled=true")
            addArguments(*(args + excludeArgs).toTypedArray())
            setStandardOutput(teeStdout)
            setStandardError(teeStderr)
            withDetailedFailure()
          }
          .run()
    } else {
      // Build task — use BuildLauncher
      val excludeArgs = excludeTasks.map { "--exclude-task=$it" }
      connection
          .newBuild()
          .apply {
            forTasks(task.taskName)
            addArguments(*(args + excludeArgs).toTypedArray())
            setStandardOutput(teeStdout)
            setStandardError(teeStderr)
            withDetailedFailure()
          }
          .run()
    }

    val endTime = System.currentTimeMillis()
    val output = stdoutCapture.toString()
    logger.info("Task $taskId completed successfully in ${endTime - startTime}ms")
    return TaskResult(
        success = true, startTime = startTime, endTime = endTime, terminalOutput = output)
  } catch (e: Exception) {
    val endTime = System.currentTimeMillis()
    val output = stdoutCapture.toString()
    val errorOutput = stderrCapture.toString()
    val combinedOutput = buildString {
      if (output.isNotBlank()) appendLine(output)
      if (errorOutput.isNotBlank()) appendLine(errorOutput)
      appendLine("Exception: ${e.message}")
    }
    logger.warning("Task $taskId failed in ${endTime - startTime}ms: ${e.message}")
    return TaskResult(
        success = false, startTime = startTime, endTime = endTime, terminalOutput = combinedOutput)
  } finally {
    teeStdout.close()
    teeStderr.close()
    stdoutCapture.close()
    stderrCapture.close()
  }
}

/** Build common Gradle arguments for task execution. */
private fun buildArgs(additionalArgs: String): List<String> {
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

  return args
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
