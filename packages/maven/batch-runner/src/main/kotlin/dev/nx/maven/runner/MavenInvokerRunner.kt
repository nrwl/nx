package dev.nx.maven.runner

import dev.nx.maven.data.MavenBatchOptions
import dev.nx.maven.data.MavenBatchTask
import dev.nx.maven.data.TaskGraph
import dev.nx.maven.data.TaskResult
import dev.nx.maven.utils.removeTasksFromTaskGraph
import org.apache.maven.shared.invoker.DefaultInvocationRequest
import org.apache.maven.shared.invoker.DefaultInvoker
import org.apache.maven.shared.invoker.InvocationRequest
import org.apache.maven.shared.invoker.Invoker
import org.slf4j.LoggerFactory
import java.io.File
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CountDownLatch
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

class MavenInvokerRunner(private val workspaceRoot: File, private val options: MavenBatchOptions) {
  private val log = LoggerFactory.getLogger(MavenInvokerRunner::class.java)
  @Volatile
  private var shutdownRequested = false
  private var executor: ExecutorService? = null

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
    val taskOutput = StringBuilder()
    val invoker = createInvoker()

    return try {
      val request = createInvocationRequest(taskId)

      // If task has no goals, return success immediately
      if (request == null) {
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

      invoker.setOutputHandler { line ->
        taskOutput.append(line).append(System.lineSeparator())
        log.info("[$taskId] $line")
      }

      val result = invoker.execute(request)
      val success = result.exitCode == 0
      val endTime = System.currentTimeMillis()

      log.info("Task $taskId completed with exit code: ${result.exitCode}")

      TaskResult(
        taskId = taskId,
        success = success,
        terminalOutput = taskOutput.toString(),
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
        terminalOutput = taskOutput.toString() + "\nError: $errorMsg",
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


  private fun buildTargets(task: MavenBatchTask): List<String> {
    val targets = mutableListOf<String>()

    // Add user-specified goals
    targets.addAll(task.goals)

    return targets
  }

  private fun createInvocationRequest(taskId: String): InvocationRequest? {
    val mavenBatchTask = options.tasks.getValue(taskId)
    val targets = buildTargets(mavenBatchTask)

    log.info("Task $taskId has ${targets.size} targets")

    // If task has no goals, return null
    if (targets.isEmpty()) {
      log.debug("Task $taskId has no goals, skipping invocation request creation")
      return null
    }

    val request = DefaultInvocationRequest()
    request.baseDirectory = File(options.workspaceRoot)

    // Set the pom file explicitly
    val pomFile = File(options.workspaceRoot, "pom.xml")
    if (pomFile.exists()) {
      request.pomFile = pomFile
      log.info("Using pom file: ${pomFile.absolutePath}")
    }

    // Get the actual project from task graph and use projectRoot as module selector
    val task = options.taskGraph?.tasks?.get(taskId)
    if (task != null) {
      log.info("DEBUG: Found task for taskId '$taskId'")
      log.info("DEBUG: task.target.project = '${task.target.project}'")
      log.info("DEBUG: task.projectRoot = '${task.projectRoot}'")

      // Use projectRoot if available, otherwise fall back to target.project
      if (task.projectRoot != null) {
        request.projects = mutableListOf(task.projectRoot)
        log.info("Using projectRoot as selector: ${task.projectRoot}")
      } else {
        request.projects = mutableListOf(task.target.project)
        log.info("Using target.project as selector: ${task.target.project}")
      }
    } else {
      log.warn("Could not find task for taskId '$taskId' in task graph")
    }

    request.goals = mutableListOf()

    // Add Nx Maven record goal before user goals
    request.goals.add("dev.nx.maven:nx-maven-plugin:apply")
    request.goals.addAll(targets)
    log.debug("Added targets from task $taskId: ${targets.joinToString(", ")}")

    // Add Nx Maven record goal after user goals
    request.goals.add("dev.nx.maven:nx-maven-plugin:record")

    request.isRecursive = false

    log.info("Executing ${request.goals.joinToString(", ")} goals for task: $taskId")

    // Add additional arguments
    val allArgs = mutableListOf<String>()
    allArgs.addAll(options.args)
    allArgs.addAll(mavenBatchTask.args)

    request.isBatchMode = true

    if (options.verbose && !allArgs.contains("-X")) {
      allArgs.add("-X")
    } else if (options.quiet && !allArgs.contains("-q")) {
      allArgs.add("-q")
    }

    request.mavenOpts = System.getenv("MAVEN_OPTS")

    log.debug("Invocation arguments: ${allArgs.joinToString(" ")}")

    return request
  }

  private fun createInvoker(): Invoker {
    val invoker = DefaultInvoker()

//        // Try to locate Maven
//        val mavenHome = findMavenHome()
//        if (mavenHome != null) {
//            invoker.mavenHome = mavenHome
//            log.info("Using Maven home: ${mavenHome.absolutePath}")
//        } else {
//            log.warn("Maven home not found, using system Maven")
//        }
//
//        // Set local repository directory
//        val localRepoPath = System.getenv("M2_HOME")?.let { File(it, "repository") }
//            ?: File(System.getProperty("user.home"), ".m2/repository")
//
//        if (localRepoPath.exists() || localRepoPath.parentFile?.exists() == true) {
//            invoker.localRepositoryDirectory = localRepoPath
//            log.info("Using local repository: ${localRepoPath.absolutePath}")
//        }

    invoker.mavenHome = workspaceRoot
    invoker.mavenExecutable = File(workspaceRoot, "mvnw")
    invoker.workingDirectory = workspaceRoot

    return invoker
  }

  private fun extractMavenHomeFromVersion(mavenCommand: String): File? {
    return try {
      val process = ProcessBuilder(mavenCommand, "-version")
        .redirectErrorStream(true)
        .start()

      val output = process.inputStream.bufferedReader().readText()
      process.waitFor()

      // Look for "Maven home:" in the output
      val homePattern = Regex("Maven home: (.+)")
      val match = homePattern.find(output)

      if (match != null) {
        val homePath = match.groupValues[1].trim()
        val homeDir = File(homePath)
        if (homeDir.exists() && homeDir.isDirectory) {
          log.info("Extracted Maven home from $mavenCommand: $homePath")
          return homeDir
        }
      }

      null
    } catch (e: Exception) {
      log.debug("Failed to execute $mavenCommand -version", e)
      null
    }
  }
}
