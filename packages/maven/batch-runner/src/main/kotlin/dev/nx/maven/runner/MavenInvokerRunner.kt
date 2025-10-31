package dev.nx.maven.runner

import dev.nx.maven.data.MavenBatchOptions
import dev.nx.maven.data.MavenBatchTask
import dev.nx.maven.data.TaskGraph
import dev.nx.maven.data.TaskResult
import dev.nx.maven.utils.removeTasksFromTaskGraph
import org.apache.maven.api.cli.ExecutorRequest
import org.apache.maven.cling.executor.embedded.EmbeddedMavenExecutor
import org.slf4j.LoggerFactory
import java.io.ByteArrayOutputStream
import java.io.File
import java.nio.file.Files
import java.nio.file.Paths
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CountDownLatch
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * Batch runner that executes Maven tasks using the Maven 4.x EmbeddedMavenExecutor API.
 *
 * Executes tasks in parallel batches based on task graph roots.
 * - Dynamic task graph execution with root recalculation
 * - Failure cascading: dependent tasks skipped when a task fails
 * - Parallel execution of independent root tasks
 * - Single EmbeddedMavenExecutor instance reused with context caching (in-process execution)
 * - Automatic state restoration and realm cleanup between tasks
 */
class MavenInvokerRunner(private val workspaceRoot: File, private val options: MavenBatchOptions) {
  private val log = LoggerFactory.getLogger(MavenInvokerRunner::class.java)

  @Volatile
  private var shutdownRequested = false
  private var executor: ExecutorService? = null

  // Single EmbeddedMavenExecutor instance with context caching enabled
  // Requires MAVEN_HOME environment variable to be set
  private val embeddedExecutor = EmbeddedMavenExecutor(true, true)

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

    // Resolve Maven home once at the start (reused for all tasks)
    val mavenHome = resolveMavenHome()
    log.info("Using Maven home: $mavenHome")

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
          results,
          mavenHome
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
    results: ConcurrentHashMap<String, TaskResult>,
    mavenHome: String
  ): List<TaskResult> {
    val batchResults = mutableListOf<TaskResult>()
    val latch = CountDownLatch(rootTaskIds.size)

    for (taskId in rootTaskIds) {
      if (shutdownRequested) break

      executor!!.submit {
        try {
          val result = executeSingleTask(taskId, results, mavenHome)
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
    results: ConcurrentHashMap<String, TaskResult>,
    mavenHome: String
  ): TaskResult {
    val startTime = System.currentTimeMillis()

    // Get the task and its goals/arguments
    val mavenBatchTask = options.tasks.getValue(taskId)

    // If task has no goals, return success immediately
    if (mavenBatchTask.goals.isEmpty()) {
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
    val goals = buildGoals(mavenBatchTask)
    val arguments = buildArguments(taskId, mavenBatchTask)

    // Capture Maven output
    val output = ByteArrayOutputStream()

    return try {
      log.info("Executing ${goals.joinToString(", ")} for task: $taskId")

      // Build ExecutorRequest for EmbeddedMavenExecutor using mavenBuilder factory
      // Combine goals and arguments for the request
      val allArguments = mutableListOf<String>()
      allArguments.addAll(goals)
      allArguments.addAll(arguments)

      val request = ExecutorRequest.mavenBuilder(Paths.get(mavenHome))
        .arguments(allArguments)
        .cwd(workspaceRoot.toPath())
        .stdOut(output)
        .stdErr(output)
        .build()

      // Execute using EmbeddedMavenExecutor (reused instance with context caching)
      val exitCode = embeddedExecutor.execute(request)

      val success = exitCode == 0
      val endTime = System.currentTimeMillis()
      val duration = endTime - startTime
      val outputText = output.toString()

      log.info("Task $taskId completed with exit code: $exitCode (${duration}ms)")
      if (outputText.isNotEmpty()) {
        log.info("Task $taskId output:\n$outputText")
      }

      TaskResult(
        taskId = taskId,
        success = success,
        terminalOutput = outputText,
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
    // Shutdown thread pool executor
    val exec = executor
    if (exec != null && !exec.isShutdown) {
      log.info("Initiating graceful shutdown of thread pool executor...")
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
          log.info("✅ Thread pool executor gracefully shut down")
        }
      } catch (e: InterruptedException) {
        log.warn("Interrupted while waiting for executor shutdown, forcing shutdown...")
        exec.shutdownNow()
        Thread.currentThread().interrupt()
      }
    }

    // Close EmbeddedMavenExecutor (cleans up cached contexts and class realms)
    try {
      log.info("Closing EmbeddedMavenExecutor...")
      embeddedExecutor.close()
      log.info("✅ EmbeddedMavenExecutor closed")
    } catch (e: Exception) {
      log.error("Failed to close EmbeddedMavenExecutor: ${e.message}", e)
    }
  }

  private fun resolveMavenHome(): String {
    // Strategy 1: Check for mvnw wrapper in workspace (preferred - ensures correct Maven version)
    val mvnw = File(workspaceRoot, "mvnw")
    val mvnwDir = File(workspaceRoot, ".mvn")
    val mvnwWrapperDir = File(workspaceRoot, ".mvn/wrapper")

    if (mvnw.exists() && mvnwDir.exists()) {
      log.info("Found mvnw wrapper in workspace at: ${workspaceRoot.absolutePath}")

      // Look for downloaded Maven in .mvn/wrapper/maven-*/
      if (mvnwWrapperDir.exists()) {
        mvnwWrapperDir.listFiles()?.forEach { dir ->
          if (dir.name.startsWith("maven-") && dir.isDirectory) {
            log.info("Found Maven in mvnw wrapper cache: ${dir.absolutePath}")
            return dir.absolutePath
          }
        }
      }

      // If Maven not yet downloaded by wrapper, log and continue to next strategy
      // EmbeddedMavenExecutor needs a real Maven installation, not the workspace root
      log.info("mvnw wrapper found but Maven not yet downloaded; checking other strategies...")
    }

    // Strategy 2: Check "which mvn" and go up 2 directories to find Maven home
    try {
      val process = ProcessBuilder("which", "mvn").start()
      val mvnPath = process.inputStream.bufferedReader().use { it.readText().trim() }
      if (mvnPath.isNotEmpty()) {
        val mvnFile = File(mvnPath).canonicalFile
        val mavenHome = mvnFile.parentFile.parentFile.absolutePath
        val mavenPath = Paths.get(mavenHome)
        if (Files.isDirectory(mavenPath)) {
          log.info("Found Maven via 'which mvn': $mavenHome")
          return mavenHome
        }
      }
    } catch (e: Exception) {
      // "which" command not available or mvn not in PATH
    }

    // Strategy 3: Check MAVEN_HOME environment variable
    val mavenHomeEnv = System.getenv("MAVEN_HOME")
    if (mavenHomeEnv != null) {
      val mavenPath = Paths.get(mavenHomeEnv)
      if (Files.isDirectory(mavenPath)) {
        log.info("Using MAVEN_HOME: $mavenHomeEnv")
        return mavenHomeEnv
      } else {
        log.warn("MAVEN_HOME points to non-existent directory: $mavenHomeEnv")
      }
    }

    // Strategy 4: Check maven.home system property (set by Maven itself)
    val mavenHomeProp = System.getProperty("maven.home")
    if (mavenHomeProp != null) {
      val mavenPath = Paths.get(mavenHomeProp)
      if (Files.isDirectory(mavenPath)) {
        log.info("Using maven.home system property: $mavenHomeProp")
        return mavenHomeProp
      }
    }

    // Strategy 5: Check common installation locations
    val userHome = System.getProperty("user.home")
    val commonLocations = mutableListOf(
      "/usr/local/maven",
      "/opt/maven",
      "/usr/share/maven",
      "$userHome/.m2/mvn",
      "$userHome/.local/share/mise/installs/maven",  // mise version manager
      System.getenv("M2_HOME")
    ).filterNotNull().toMutableList()

    // Also check for mise managed Maven installations
    val miseDir = File(userHome, ".local/share/mise/installs/maven")
    if (miseDir.exists()) {
      miseDir.listFiles()?.sortedByDescending { it.name }?.forEach { versionDir ->
        versionDir.listFiles()?.forEach { possibleMaven ->
          if (possibleMaven.name.startsWith("apache-maven-") && possibleMaven.isDirectory) {
            commonLocations.add(possibleMaven.absolutePath)
          }
        }
      }
    }

    for (location in commonLocations) {
      val mavenPath = Paths.get(location)
      if (Files.isDirectory(mavenPath)) {
        log.info("Found Maven at: $location")
        return location
      }
    }

    // If all strategies fail, provide helpful error message
    throw IllegalStateException(
      """
      Could not find Maven installation. Please do one of the following:

      Option 1 (Recommended): Use mvnw wrapper from workspace
        - Ensure mvnw and .mvn/ exist in workspace: ${workspaceRoot.absolutePath}

      Option 2: Set MAVEN_HOME environment variable
        export MAVEN_HOME=/path/to/maven/4.0.0-rc-4

      Option 3: Install Maven in one of these common locations:
        - /usr/local/maven
        - /opt/maven
        - /usr/share/maven
        - ~/.m2/mvn
        - Use 'mise' version manager: mise install maven@4.0.0-rc-4

      Current status:
        - mvnw found: ${mvnw.exists()}
        - .mvn directory found: ${mvnwDir.exists()}
        - MAVEN_HOME: ${System.getenv("MAVEN_HOME") ?: "not set"}
        - Workspace root: ${workspaceRoot.absolutePath}
      """.trimIndent()
    )
  }

  private fun buildGoals(mavenBatchTask: MavenBatchTask): List<String> {
    val goals = mutableListOf<String>()

    // Add Nx Maven apply goal before user goals
    goals.add("dev.nx.maven:nx-maven-plugin:apply")

    // Add user-specified goals
    goals.addAll(mavenBatchTask.goals)

    // Add Nx Maven record goal after user goals
    goals.add("dev.nx.maven:nx-maven-plugin:record")

    return goals
  }

  private fun buildArguments(taskId: String, mavenBatchTask: MavenBatchTask): List<String> {
    val arguments = mutableListOf<String>()

    // Batch mode flag
    arguments.add("-B")

    // Verbose and quiet flags
    if (options.verbose) {
      arguments.add("-X")
    }

    // Module selector (always pass the project)
    val task = options.taskGraph?.tasks?.get(taskId)
    val projectSelector = task?.projectRoot ?: task?.target?.project ?: mavenBatchTask.project
    arguments.add("-pl")
    arguments.add(projectSelector)

    return arguments
  }
}
