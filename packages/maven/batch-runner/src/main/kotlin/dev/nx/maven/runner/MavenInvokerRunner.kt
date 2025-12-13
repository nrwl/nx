package dev.nx.maven.runner

import com.google.gson.Gson
import dev.nx.maven.data.MavenBatchOptions
import dev.nx.maven.data.MavenBatchTask
import dev.nx.maven.data.TaskResult
import dev.nx.maven.utils.removeTasksFromTaskGraph
import org.slf4j.LoggerFactory
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.CountDownLatch
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference

/** Task execution state for tracking progress */
enum class TaskState {
  SUCCEEDED,
  FAILED,
  SKIPPED
}

/** Executes Maven tasks in parallel using a work-stealing scheduler. */
class MavenInvokerRunner(private val workspaceRoot: File, private val options: MavenBatchOptions) {
  private val log = LoggerFactory.getLogger(MavenInvokerRunner::class.java)
  private val gson = Gson()

  // Detect Maven home once - used for executor initialization
  private val mavenDiscovery = MavenHomeDiscovery(workspaceRoot).discoverMavenHomeWithVersion()
  private val isMaven4 = mavenDiscovery?.version?.startsWith("4") == true

  // Maven executor - automatically selects appropriate implementation:
  // - Maven 4.x: ResidentMavenExecutor (ResidentMavenInvoker + NxMaven caching)
  // - Maven 3.x: Maven3ResidentExecutor (MavenCli via reflection)
  // Works across all Maven versions via reflection
  private val mavenExecutor: MavenExecutor = MavenExecutorFactory.create(
      mavenHome = mavenDiscovery?.mavenHome
  )

  fun runBatch(): Map<String, TaskResult> {
    val results = ConcurrentHashMap<String, TaskResult>()
    val numWorkers = Runtime.getRuntime().availableProcessors()

    // Create thread pool with daemon threads so they don't prevent JVM exit
    val executor = Executors.newFixedThreadPool(numWorkers) { runnable ->
      Thread(runnable).apply {
        isDaemon = true
      }
    }

    log.debug("Thread pool size: $numWorkers")

    val initialGraph = options.taskGraph
    if (initialGraph == null) {
      log.error("Task graph is null, cannot execute tasks")
      executor.shutdown()
      return emptyMap()
    }

    log.debug("🚀 Starting work-stealing task queue execution (max parallelization)")
    log.debug("Initial roots: ${initialGraph.roots.joinToString(", ")}")

    // Thread-safe queue of ready tasks and graph state
    val taskQueue = LinkedBlockingQueue<String>(initialGraph.roots)
    val graphRef = AtomicReference(initialGraph)
    // Single map to track task states instead of three separate boolean maps
    val taskStates = ConcurrentHashMap<String, TaskState>()

    // Latch to signal when all tasks are done
    val completionLatch = CountDownLatch(initialGraph.tasks.size)
    val totalTasks = initialGraph.tasks.size
    val workerIdCounter = AtomicInteger(0)

    println("[DEBUG] Total tasks: $totalTasks, Workers: $numWorkers, Initial queue size: ${taskQueue.size}")

    try {
      // Submit worker tasks that pull from the queue
      repeat(numWorkers) {
        executor.submit {
          val workerId = workerIdCounter.incrementAndGet()
          log.debug("Worker $workerId starting")

          while (true) {
            val taskId = taskQueue.poll()

            if (taskId == null) {
              log.debug("Worker $workerId exiting loop (poll returned null)")
              break
            }

            if (taskStates.containsKey(taskId)) {
              log.debug("Worker $workerId: task $taskId already processed, counting down")
              completionLatch.countDown()
              continue
            }

            val taskOptions = options.taskOptions[taskId]
            log.debug("Worker $workerId executing task: $taskId, goals: ${taskOptions?.goals}, project: ${taskOptions?.project}")
            val result = executeSingleTask(taskId, results)

            // Emit result to stderr for streaming to Nx
            emitResult(taskId, result)

            // Record task state
            val success = results[taskId]?.success == true
            taskStates[taskId] = if (success) TaskState.SUCCEEDED else TaskState.FAILED
            log.debug("Worker $workerId: task $taskId done (success=$success), taskStates: ${taskStates.size}/$totalTasks")

            // Update graph and find newly available tasks
            synchronized(graphRef) {
              val currentGraph = graphRef.get()
              val newGraph = removeTasksFromTaskGraph(
                currentGraph,
                if (success) listOf(taskId) else emptyList(),
                if (!success) listOf(taskId) else emptyList()
              )
              graphRef.set(newGraph)

              // Add newly available root tasks to queue
              val previousRoots = currentGraph.roots.toSet()
              val newRoots = newGraph.roots.filter { it !in previousRoots && !taskStates.containsKey(it) }
              newRoots.forEach { newTaskId ->
                if (!taskStates.containsKey(newTaskId)) {
                  taskQueue.offer(newTaskId)
                  log.debug("Worker $workerId added newly available task to queue: $newTaskId, queue size now: ${taskQueue.size}")
                }
              }

              // Mark skipped tasks (those removed due to failed dependencies)
              // Skipped tasks are omitted from results, not marked as failed
              val oldTasks = currentGraph.tasks.keys
              val newTasks = newGraph.tasks.keys
              val skippedTasks = oldTasks - newTasks - taskStates.keys
              skippedTasks.forEach { skippedTaskId ->
                log.debug("Task $skippedTaskId was skipped due to a failed dependency")
                taskStates[skippedTaskId] = TaskState.SKIPPED
                // IMPORTANT: Count down skipped tasks too, or latch will never reach zero
                completionLatch.countDown()
              }
            }

            log.debug("Worker $workerId counting down latch, current count: ${completionLatch.count}")
            completionLatch.countDown()
          }
        }
      }

      log.debug("All workers submitted, waiting for completion latch (count: ${completionLatch.count})...")
      // Wait for all tasks to complete
      completionLatch.await()
      log.debug("Latch completed!")

      // Record build states for all projects that had tasks executed
      log.debug("Starting recordBuildStatesForExecutedTasks...")
      recordBuildStatesForExecutedTasks()
      log.debug("recordBuildStatesForExecutedTasks completed")
    } finally {
      // Threads are daemon threads, so they won't prevent JVM exit
      // Just try to shutdown gracefully without waiting
      try {
        executor.shutdownNow()
      } catch (e: Exception) {
        log.debug("Error shutting down executor: ${e.message}")
      }
    }

    log.debug("Returning ${results.size} results with task IDs: ${results.keys.joinToString(", ")}")
    return results.toMap()
  }

  /**
   * Record build states for all unique projects that had tasks executed.
   * This is called after all tasks complete to save the build state for future batches.
   */
  private fun recordBuildStatesForExecutedTasks() {
    try {
      // Get NxMaven instance if available (only available with ResidentMavenExecutor)
      val nxMaven = (mavenExecutor as? ResidentMavenExecutor)?.getNxMaven()

      if (nxMaven == null) {
        log.debug("NxMaven not available, skipping build state recording")
        return
      }

      // Extract unique project selectors from executed tasks
      val uniqueProjectSelectors = options.taskGraph?.tasks?.values
        ?.map { it.target.project }
        ?.toSet() ?: emptySet()

      if (uniqueProjectSelectors.isEmpty()) {
        log.debug("No projects to record build states for")
        return
      }

      log.debug("📝 Preparing to record build states for ${uniqueProjectSelectors.size} unique projects")
      log.debug("Projects: ${uniqueProjectSelectors.joinToString(", ")}")
      nxMaven.recordBuildStates(uniqueProjectSelectors)
    } catch (e: Exception) {
      log.error("❌ Error recording build states: ${e.message}", e)
    }
  }

  private fun executeSingleTask(
    taskId: String,
    results: MutableMap<String, TaskResult>
  ): TaskResult {
    val startTime = System.currentTimeMillis()

    // Get the task and its goals/arguments
    val mavenBatchTask = options.taskOptions.getValue(taskId)

    // If task has no goals, return success immediately
    if (mavenBatchTask.goals.isEmpty()) {
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
    // Strip execution ID suffix (e.g., "install:install@default-install" -> "install:install")
    // The @executionId suffix is used for Nx target naming but not valid for Maven CLI
    val goals = mavenBatchTask.goals.map { goal ->
      val atIndex = goal.indexOf('@')
      if (atIndex > 0) goal.substring(0, atIndex) else goal
    }
    val arguments = buildArguments(mavenBatchTask)

    // Capture Maven output
    val output = ByteArrayOutputStream()

    return try {
      log.debug("Executing ${goals.joinToString(", ")} for task: $taskId")
      log.debug("Maven execution: goals=${goals}, args=${arguments}")

      // Execute using ResidentMavenExecutor with context caching
      // Works across all Maven 4.x versions via reflection-based implementation
      val exitCode = mavenExecutor.execute(
        goals = goals,
        arguments = arguments,
        workingDir = workspaceRoot,
        outputStream = output
      )

      val success = exitCode == 0
      val endTime = System.currentTimeMillis()
      val duration = endTime - startTime
      val outputText = output.toString()

      if (success) {
        log.debug("Task $taskId completed successfully with exit code: $exitCode (${duration}ms)")
        if (outputText.isNotEmpty()) {
          log.debug("Maven output for task $taskId:\n$outputText")
        }
      } else {
        // Log at ERROR level when task fails so user can see what went wrong
        log.error("Task $taskId FAILED with exit code: $exitCode (${duration}ms)")
        // Also print to stdout since SLF4J may be NOP with Maven 3.x
        println("[ERROR] Task $taskId FAILED with exit code: $exitCode (${duration}ms)")
        println("[ERROR] Goals: ${goals.joinToString(", ")}")
        println("[ERROR] Arguments: ${arguments.joinToString(" ")}")
        println("[ERROR] Working directory: $workspaceRoot")
        println("[ERROR] Output size: ${outputText.length} bytes")
        if (outputText.isNotEmpty()) {
          log.error("Maven output for failed task $taskId:\n$outputText")
          println("[ERROR] Maven output for failed task $taskId:\n$outputText")
        } else {
          log.error("Task $taskId had no output from Maven")
          println("[ERROR] Task $taskId had no output from Maven")
        }
      }

      val result = TaskResult(
        taskId = taskId,
        success = success,
        terminalOutput = outputText,
        startTime = startTime,
        endTime = endTime
      )
      results[taskId] = result
      result
    } catch (e: Exception) {
      val errorMsg = e.message ?: "Unknown error"
      val endTime = System.currentTimeMillis()
      val outputText = output.toString()

      log.error("Task $taskId failed with exception: $errorMsg", e)
      if (outputText.isNotEmpty()) {
        log.error("Maven output before exception for task $taskId:\n$outputText")
      }

      val result = TaskResult(
        taskId = taskId,
        success = false,
        terminalOutput = "$outputText\nError: $errorMsg",
        startTime = startTime,
        endTime = endTime
      )
      results[taskId] = result
      result
    }
  }

  /**
   * Emit a task result to stderr as JSON for streaming to Nx.
   * Format: NX_RESULT:{"task":"taskId","result":{...}}
   */
  private fun emitResult(taskId: String, result: TaskResult) {
    val resultData = mapOf(
      "task" to taskId,
      "result" to mapOf(
        "success" to result.success,
        "terminalOutput" to result.terminalOutput,
        "startTime" to result.startTime,
        "endTime" to result.endTime
      )
    )
    val json = gson.toJson(resultData)
    System.err.println("NX_RESULT:$json")
    System.err.flush()
  }

  private fun buildArguments(mavenBatchTask: MavenBatchTask): List<String> {
    val arguments = mutableListOf<String>()

    // Always add -e to show errors
    arguments.add("-e")

    // Verbose flag for debug output
    if (options.verbose) {
      arguments.add("-X")
    }

    // Non-recursive (-N) tells Maven to only build the specified project, not modules
    // This prevents loading all projects in the reactor, significantly reducing overhead
    // Only use with Maven 4.x - Maven 3.x needs to scan modules to find projects
    if (isMaven4) {
      arguments.add("-N")
    }

    // Module selector (always pass the project)
    arguments.add("-pl")
    arguments.add(mavenBatchTask.project)

    // Add task-specific arguments (e.g., -Dtest=TestClass for atomized tests)
    arguments.addAll(mavenBatchTask.args)

    return arguments
  }
}
