package dev.nx.maven.runner

import dev.nx.maven.data.MavenBatchOptions
import dev.nx.maven.data.MavenBatchTask
import dev.nx.maven.data.TaskResult
import dev.nx.maven.data.Task
import dev.nx.maven.utils.MavenCommandResolver
import org.apache.maven.shared.invoker.DefaultInvoker
import org.apache.maven.shared.invoker.DefaultInvocationRequest
import org.apache.maven.shared.invoker.InvocationRequest
import org.apache.maven.shared.invoker.Invoker
import org.slf4j.LoggerFactory
import java.io.File
import com.google.gson.Gson
import java.util.concurrent.Executors
import java.util.concurrent.ConcurrentHashMap

class MavenInvokerRunner(private val options: MavenBatchOptions) {
    private val log = LoggerFactory.getLogger(MavenInvokerRunner::class.java)

    fun runBatch(): Map<String, TaskResult> {
        val results = ConcurrentHashMap<String, TaskResult>()

        log.info("Received ${options.tasks.size} tasks")

        // Parse task graph to get execution order and extract task dependencies
        val taskIds = getTaskExecutionOrder()
        log.info("Task execution order from graph: ${taskIds.joinToString(", ")}")

        // Group tasks by project
        val tasksByProject = groupTasksByProject()
        log.info("Grouped tasks into ${tasksByProject.size} projects")
        for ((project, tasks) in tasksByProject) {
            log.info("  Project '$project': ${tasks.joinToString(", ")}")
        }

        // Get number of parallel threads (default to number of projects, min 1)
        val numThreads = Math.max(1, tasksByProject.size)
        val executor = Executors.newFixedThreadPool(numThreads)

        try {
            // Submit tasks for parallel execution by project
            val futures = tasksByProject.map { (project, projectTasks) ->
                executor.submit {
                    executeProjectTasks(project, projectTasks, results)
                }
            }

            // Wait for all projects to complete
            futures.forEach { it.get() }
        } finally {
            executor.shutdown()
        }

        log.info("Returning ${results.size} results with task IDs: ${results.keys.joinToString(", ")}")
        return results.toMap()
    }

    private fun executeProjectTasks(
        project: String,
        projectTasks: List<String>,
        results: ConcurrentHashMap<String, TaskResult>
    ) {
        log.info("Executing ${projectTasks.size} tasks for project: $project")

        // Create a fresh invoker for this thread
        val invoker = createInvoker()
        // Collect output for this project
        val projectOutput = StringBuilder()

        try {
            val request = createInvocationRequest(project, projectTasks)

            // Set output handler to capture Maven output
            invoker.setOutputHandler { line ->
                projectOutput.append(line).append(System.lineSeparator())
                log.debug("[$project] $line")
            }

            log.info("Executing Maven invocation for project: $project with tasks: ${projectTasks.joinToString(", ")}")
            val result = invoker.execute(request)
            val success = result.exitCode == 0

            log.info("Project $project completed with exit code: ${result.exitCode}")

            // Store result for each task in the project
            for (taskId in projectTasks) {
                results[taskId] = TaskResult(
                    taskId = taskId,
                    success = success,
                    terminalOutput = projectOutput.toString()
                )

                if (success) {
                    log.info("✓ Task executed successfully: $taskId")
                } else {
                    log.warn("✗ Task failed with exit code ${result.exitCode}: $taskId")
                }
            }
        } catch (e: Exception) {
            val errorMsg = e.message ?: "Unknown error"
            log.error("✗ Project $project failed: $errorMsg", e)

            // Store failure for each task in the project
            for (taskId in projectTasks) {
                results[taskId] = TaskResult(
                    taskId = taskId,
                    success = false,
                    terminalOutput = projectOutput.toString() + "\nError: $errorMsg"
                )
            }
        }
    }

    private fun getTaskExecutionOrder(): List<String> {
        return try {
            val taskGraph = options.taskGraph

            if (taskGraph == null) {
                log.warn("Task graph is null, using all available tasks")
                options.tasks.keys.toList()
            } else {
                // Extract task IDs from the "tasks" field in the task graph
                if (taskGraph.tasks.isNotEmpty()) {
                    taskGraph.tasks.keys.toList()
                } else {
                    log.warn("No tasks in task graph, using all available tasks")
                    options.tasks.keys.toList()
                }
            }
        } catch (e: Exception) {
            log.warn("Failed to access task graph: ${e.message}, using all available tasks")
            options.tasks.keys.toList()
        }
    }

    private fun groupTasksByProject(): LinkedHashMap<String, MutableList<String>> {
        val grouped = LinkedHashMap<String, MutableList<String>>()

        for ((taskId, task) in options.tasks) {
          val project = task.project
          grouped.computeIfAbsent(project) { mutableListOf() }.add(taskId)
        }

        return grouped
    }

    private fun buildTargets(task: MavenBatchTask): List<String> {
        val targets = mutableListOf<String>()

        // Add user-specified goals
        targets.addAll(task.goals)

        return targets
    }

    private fun createInvocationRequest(project: String, taskIds: List<String>): InvocationRequest {
        val request = DefaultInvocationRequest()
        request.baseDirectory = File(options.workspaceRoot)

        // Set the pom file explicitly
        val pomFile = File(options.workspaceRoot, "pom.xml")
        if (pomFile.exists()) {
            request.pomFile = pomFile
            log.info("Using pom file: ${pomFile.absolutePath}")
        }

        // Get the actual project from task graph and use projectRoot as module selector
        val task = options.taskGraph?.tasks?.values?.find { it.target.project == project }
        if (task != null) {
            log.info("DEBUG: Found task for project '$project'")
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
            log.warn("Could not find task for project '$project' in task graph")
        }

        request.goals = mutableListOf()
        // Collect all goals from tasks (with Nx wrapper goals)

      // Add Nx Maven record goal after user goals
      request.goals.add("dev.nx.maven:nx-maven-plugin:apply")
        for (taskId in taskIds) {
            val task = options.tasks[taskId] ?: continue
            val targets = buildTargets(task)
            request.goals.addAll(targets)
            log.debug("Added targets from task $taskId: ${targets.joinToString(", ")}")
        }

      // Add Nx Maven record goal after user goals
      request.goals.add("dev.nx.maven:nx-maven-plugin:record")

      request.isRecursive = false

        log.info("Executing ${request.goals.joinToString(", ")} goals for project: $project")

        // Add additional arguments
        val allArgs = mutableListOf<String>()
        allArgs.addAll(options.args)

        for (taskId in taskIds) {
            val task = options.tasks[taskId] ?: continue
            allArgs.addAll(task.args)
        }

      request.isBatchMode = true

        if (options.verbose && !allArgs.contains("-X")) {
            allArgs.add("-X")
        } else if (options.quiet && !allArgs.contains("-q")) {
            allArgs.add("-q")
        }

        request.mavenOpts = System.getenv("MAVEN_OPTS")

        log.debug("Invocation arguments: ${allArgs.joinToString(" ")}")

        // Note: DefaultInvocationRequest doesn't have public setter for arguments
        // Goals are already set above, additional args would need to be handled differently
        // For now, we rely on goals being sufficient

        return request
    }

    private fun createInvoker(): Invoker {
        val invoker = DefaultInvoker()

        // Try to locate Maven
        val mavenHome = findMavenHome()
        if (mavenHome != null) {
            invoker.mavenHome = mavenHome
            log.info("Using Maven home: ${mavenHome.absolutePath}")
        } else {
            log.warn("Maven home not found, using system Maven")
        }

        // Set local repository directory
        val localRepoPath = System.getenv("M2_HOME")?.let { File(it, "repository") }
            ?: File(System.getProperty("user.home"), ".m2/repository")

        if (localRepoPath.exists() || localRepoPath.parentFile?.exists() == true) {
            invoker.localRepositoryDirectory = localRepoPath
            log.info("Using local repository: ${localRepoPath.absolutePath}")
        }

        return invoker
    }

    private fun findMavenHome(): File? {
        // First, try to detect Maven using MavenCommandResolver
        try {
            val mavenCommand = MavenCommandResolver.getMavenCommand(File(options.workspaceRoot))
            log.info("Detected Maven command: $mavenCommand")

            // Execute Maven --version to extract the home directory
            val mavenHome = extractMavenHomeFromVersion(mavenCommand)
            if (mavenHome != null) {
                return mavenHome
            }
        } catch (e: Exception) {
            log.debug("Failed to extract Maven home from detected command", e)
        }

        // Fallback: Check MAVEN_HOME environment variable
        val mavenHome = System.getenv("MAVEN_HOME")
        if (!mavenHome.isNullOrEmpty()) {
            val home = File(mavenHome)
            if (home.exists() && home.isDirectory) {
                return home
            }
        }

        // Fallback: Check M2_HOME environment variable
        val m2Home = System.getenv("M2_HOME")
        if (!m2Home.isNullOrEmpty()) {
            val home = File(m2Home)
            if (home.exists() && home.isDirectory) {
                return home
            }
        }

        return null
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
