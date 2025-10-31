package dev.nx.maven.runner

import dev.nx.maven.data.MavenBatchOptions
import dev.nx.maven.data.MavenBatchTask
import dev.nx.maven.data.TaskGraph
import dev.nx.maven.data.TaskResult
import dev.nx.maven.utils.removeTasksFromTaskGraph
import org.apache.maven.cli.MavenCli
import org.slf4j.LoggerFactory
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.PrintStream
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CountDownLatch
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * Batch runner that executes Maven tasks using the Maven Embedder API.
 *
 * Key advantage: Single Maven instance reused for all tasks
 * - Reactor scanned once
 * - Cache reused between tasks
 * - No subprocess overhead per task
 */
class MavenInvokerRunner(private val workspaceRoot: File, private val options: MavenBatchOptions) {
  private val log = LoggerFactory.getLogger(MavenInvokerRunner::class.java)

  @Volatile
  private var shutdownRequested = false
  private var executor: ExecutorService? = null

  // Single Maven CLI instance reused for all tasks
  private val mavenCli = MavenCli()

  fun requestShutdown() {
    log.info("⚠️  Shutdown requested, stopping new task submissions...")
    shutdownRequested = true
    executor?.shutdownNow()
  }

  fun runBatch(): Map<String, TaskResult> {
    val results = ConcurrentHashMap<String, TaskResult>()

    log.info("Received ${options.tasks.size} tasks")

    val initialGraph = options.taskGraph
    if (initialGraph == null) {
      log.error("Task graph is null, cannot execute tasks")
      return emptyMap()
    }

    var remainingGraph: TaskGraph = initialGraph
    log.info("Initial roots: ${remainingGraph.roots.joinToString(", ")}")

    // Create thread pool for parallel root execution
    val numThreads = 4
    executor = Executors.newFixedThreadPool(numThreads)

    try {

      // While loop: execute tasks as long as there are roots
      while (remainingGraph.roots.isNotEmpty() && !shutdownRequested) {
        log.info("Executing batch of roots: ${remainingGraph.roots.joinToString(", ")}")

        // Execute all root tasks in parallel
        val batchResults = executeRootTasksInParallel(
          remainingGraph.roots,
          results
        )

        // Separate successful and failed tasks
        val successfulTaskIds = batchResults.filter { it.success }.map { it.taskId }
        val failedTaskIds = batchResults.filter { !it.success }.map { it.taskId }

        if (failedTaskIds.isNotEmpty()) {
          log.warn("Failed tasks: ${failedTaskIds.joinToString(", ")}")
        }

        // Remove completed/failed tasks from graph and recalculate roots
        // Failed tasks and their dependents will be removed
        val oldRemainingTasks = remainingGraph.tasks.keys
        remainingGraph = removeTasksFromTaskGraph(
          remainingGraph,
          successfulTaskIds,
          failedTaskIds
        )

        // Mark tasks that were removed due to failed dependencies as skipped
        val skippedTasks = oldRemainingTasks - remainingGraph.tasks.keys - successfulTaskIds.toSet() - failedTaskIds.toSet()
        for (skippedTaskId in skippedTasks) {
          if (!results.containsKey(skippedTaskId)) {
            results[skippedTaskId] = TaskResult(
              taskId = skippedTaskId,
              success = false,
              terminalOutput = "SKIPPED: Task was skipped due to a failed dependency",
              startTime = 0,
              endTime = 0
            )
            log.info("Skipped task: $skippedTaskId (dependency failed)")
          }
        }

        log.info("Successful tasks: ${successfulTaskIds.joinToString(", ")}")
        log.info("New roots: ${remainingGraph.roots.joinToString(", ")}")
      }
    } finally {
      gracefulShutdown()
    }

    log.info("Returning ${results.size} results with task IDs: ${results.keys.joinToString(", ")}")
    return results.toMap()
  }

  private fun executeRootTasksInParallel(
    rootTaskIds: List<String>,
    results: ConcurrentHashMap<String, TaskResult>
  ): List<TaskResult> {
    val batchResults = mutableListOf<TaskResult>()
    val latch = CountDownLatch(rootTaskIds.size)

    for (taskId in rootTaskIds) {
      if (shutdownRequested) break

      executor!!.submit {
        try {
          val result = executeSingleTask(taskId, results)
          synchronized(batchResults) {
            batchResults.add(result)
          }
        } finally {
          latch.countDown()
        }
      }
    }

    // Wait for all root tasks to complete
    latch.await()
    return batchResults
  }

  private fun executeSingleTask(
    taskId: String,
    results: ConcurrentHashMap<String, TaskResult>
  ): TaskResult {
    val startTime = System.currentTimeMillis()

    // Get goals for this task
    val goals = buildGoals(taskId)

    // If task has no goals, return success immediately
    if (goals.isEmpty()) {
      log.info("Task $taskId has no goals, marking as successful")
      val endTime = System.currentTimeMillis()
      return TaskResult(
        taskId = taskId,
        success = true,
        terminalOutput = "",
        startTime = startTime,
        endTime = endTime
      ).also {
        results[taskId] = it
      }
    }

    // Capture Maven output
    val output = ByteArrayOutputStream()
    val printStream = PrintStream(output)

    return try {
      log.info("Executing ${goals.joinToString(", ")} for task: $taskId")

      // Execute using embedded Maven CLI (reused instance)
      val exitCode = mavenCli.doMain(
        goals.toTypedArray(),
        workspaceRoot.absolutePath,
        printStream,
        System.err
      )

      val success = exitCode == 0
      val endTime = System.currentTimeMillis()

      log.info("Task $taskId completed with exit code: $exitCode")

      TaskResult(
        taskId = taskId,
        success = success,
        terminalOutput = output.toString(),
        startTime = startTime,
        endTime = endTime
      ).also {
        results[taskId] = it
      }
    } catch (e: Exception) {
      val errorMsg = e.message ?: "Unknown error"
      val endTime = System.currentTimeMillis()
      log.error("Task $taskId failed: $errorMsg", e)

      TaskResult(
        taskId = taskId,
        success = false,
        terminalOutput = output.toString() + "\nError: $errorMsg",
        startTime = startTime,
        endTime = endTime
      ).also {
        results[taskId] = it
      }
    }
  }

  private fun gracefulShutdown() {
    val exec = executor ?: return

    if (!exec.isShutdown) {
      log.info("Initiating graceful shutdown of executor...")
      exec.shutdown()

      // Wait up to 30 seconds for tasks to complete
      try {
        if (!exec.awaitTermination(30, TimeUnit.SECONDS)) {
          log.warn("Executor did not terminate within 30 seconds, force shutting down...")
          exec.shutdownNow()

          // Wait another 5 seconds for forced shutdown
          if (!exec.awaitTermination(5, TimeUnit.SECONDS)) {
            log.error("Executor still not terminated after force shutdown")
          }
        } else {
          log.info("✅ Executor gracefully shut down")
        }
      } catch (e: InterruptedException) {
        log.warn("Interrupted while waiting for executor shutdown, forcing shutdown...")
        exec.shutdownNow()
        Thread.currentThread().interrupt()
      }
    }
  }

  private fun buildGoals(taskId: String): List<String> {
    val mavenBatchTask = options.tasks.getValue(taskId)
    val goals = mutableListOf<String>()

    // Add Nx Maven apply goal before user goals
    goals.add("dev.nx.maven:nx-maven-plugin:apply")

    // Add user-specified goals
    goals.addAll(mavenBatchTask.goals)

    // Add Nx Maven record goal after user goals
    goals.add("dev.nx.maven:nx-maven-plugin:record")

    // Add additional arguments (TODO: these should be passed differently with Maven Embedder)
    if (options.verbose) {
      goals.add("-X")
    }
    if (options.quiet) {
      goals.add("-q")
    }

    // Add batch mode flag
    goals.add("-B")

    // Add module selector (always pass the project)
    val task = options.taskGraph?.tasks?.get(taskId)
    val projectSelector = task?.projectRoot ?: task?.target?.project ?: mavenBatchTask.project
    goals.add("-pl")
    goals.add(projectSelector)

    return goals.filter { it !in mavenBatchTask.goals } // Avoid duplicates
  }
}
