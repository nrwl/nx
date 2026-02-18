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

  // Detect Maven home and version once - used for argument building and executor selection
  private val mavenDiscovery = MavenHomeDiscovery(workspaceRoot).discoverMavenHomeWithVersion()
  private val isMaven4 = mavenDiscovery?.version?.startsWith("4") == true

  // Maven executor - automatically selects best available strategy:
  // - Maven 4.x: ResidentMavenExecutor with context caching
  // - Maven 3.9.x: ProcessBasedMavenExecutor (fallback via subprocess)
  private val mavenExecutor = MavenExecutorFactory.create(
    workspaceRoot = workspaceRoot,
    mavenHome = mavenDiscovery?.mavenHome,
    mavenVersion = mavenDiscovery?.version
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

    try {
      // Submit worker tasks that pull from the queue
      repeat(numWorkers) {
        executor.submit {
          while (true) {
            val taskId = taskQueue.poll() ?: break

            if (taskStates.containsKey(taskId)) {
              completionLatch.countDown()
              continue
            }

            val result = executeSingleTask(taskId, results)

            // Record build state for all batch projects BEFORE emitting result.
            // emitResult() triggers Nx to cache task outputs, so nx-build-state.json
            // must be written first to ensure the cached outputs include fresh build state.
            recordBuildStatesForBatchProjects(taskId)

            // Emit result to stderr for streaming to Nx
            emitResult(taskId, result)

            // Record task state
            val success = results[taskId]?.success == true
            taskStates[taskId] = if (success) TaskState.SUCCEEDED else TaskState.FAILED

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
                  log.debug("Added newly available task to queue: $newTaskId")
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

            completionLatch.countDown()
          }
        }
      }

      // Wait for all tasks to complete
      completionLatch.await()
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

  /** All unique project selectors in the batch, computed once. */
  private val allBatchProjectSelectors: Set<String> by lazy {
    options.taskGraph?.tasks?.values
      ?.map { it.target.project }
      ?.toSet() ?: emptySet()
  }

  /**
   * Record build state for all projects in the batch.
   * Called after each task execution but before emitting the result to Nx,
   * ensuring nx-build-state.json is up-to-date when Nx caches the task's outputs.
   *
   * We record ALL batch projects (not just the current task's project) because
   * a task in projectA can modify the Maven session state of projectB
   * (e.g., adding source roots or classpath entries). The lastWrittenState cache
   * in BuildStateRecorder ensures we only perform file I/O for projects whose
   * state actually changed.
   */
  private fun recordBuildStatesForBatchProjects(taskId: String) {
    try {
      (mavenExecutor as? ResidentMavenExecutor)?.recordBuildStates(allBatchProjectSelectors)
    } catch (e: Exception) {
      log.error("Error recording build states after task $taskId: ${e.message}", e)
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
    val goals = mavenBatchTask.goals
    val arguments = buildArguments(mavenBatchTask)

    // Capture Maven output
    val output = ByteArrayOutputStream()

    return try {
      log.debug("Executing ${goals.joinToString(", ")} for task: $taskId")

      // Execute using the appropriate Maven executor (auto-selected based on Maven version)
      // Maven 4.x: ResidentMavenExecutor with context caching
      // Maven 3.9.x: ProcessBasedMavenExecutor (subprocess fallback)
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
        if (outputText.isNotEmpty()) {
          log.error("Maven output for failed task $taskId:\n$outputText")
        } else {
          log.error("Task $taskId had no output from Maven")
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

    // Verbose and quiet flags
    if (options.verbose) {
      arguments.add("-X")
      arguments.add("-e")
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
