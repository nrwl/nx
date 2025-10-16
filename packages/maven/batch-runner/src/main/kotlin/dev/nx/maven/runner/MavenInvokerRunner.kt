package dev.nx.maven.runner

import dev.nx.maven.data.MavenBatchOptions
import dev.nx.maven.data.MavenBatchTask
import dev.nx.maven.data.TaskResult
import dev.nx.maven.utils.MavenCommandResolver
import org.apache.maven.shared.invoker.DefaultInvoker
import org.apache.maven.shared.invoker.DefaultInvocationRequest
import org.apache.maven.shared.invoker.InvocationRequest
import org.apache.maven.shared.invoker.InvocationOutputHandler
import org.apache.maven.shared.invoker.Invoker
import org.slf4j.LoggerFactory
import java.io.File
import com.google.gson.Gson

class MavenInvokerRunner(private val options: MavenBatchOptions) {
    private val log = LoggerFactory.getLogger(MavenInvokerRunner::class.java)

    fun runBatch(): Map<String, TaskResult> {
        val results = mutableMapOf<String, TaskResult>()

        log.info("Received ${options.tasks.size} tasks")

        // Parse task graph to get execution order
        val taskIds = getTaskExecutionOrder()
        log.info("Task execution order from graph: ${taskIds.joinToString(", ")}")

        // Create invoker once and reuse for all requests
        val invoker = createInvoker()

        // Execute each task in the order specified by the task graph
        for (taskId in taskIds) {
            log.info("Processing task: $taskId")

            // Collect task output in a string
            val taskOutput = StringBuilder()

            try {
              val request = createInvocationRequest(listOf(taskId))

              // Set output handler on invoker to capture Maven output
              invoker.setOutputHandler { line ->
                taskOutput.append(line).append(System.lineSeparator())
              }

              log.info("Executing Maven invocation for task: $taskId")
                val result = invoker.execute(request)
                val success = result.exitCode == 0

                log.info("Task $taskId completed with exit code: ${result.exitCode}")

                results[taskId] = TaskResult(
                    taskId = taskId,
                    success = success,
                    terminalOutput = taskOutput.toString()
                )

                if (success) {
                    log.info("✓ Task executed successfully: $taskId")
                } else {
                    log.warn("✗ Task failed with exit code ${result.exitCode}: $taskId")
                }
            } catch (e: Exception) {
                val errorMsg = e.message ?: "Unknown error"
                log.error("✗ Task failed: $taskId - $errorMsg", e)

                results[taskId] = TaskResult(
                    taskId = taskId,
                    success = false,
                    terminalOutput = taskOutput.toString() + errorMsg
                )
            }
        }

        log.info("Returning ${results.size} results with task IDs: ${results.keys.joinToString(", ")}")
        return results
    }

    private fun getTaskExecutionOrder(): List<String> {
        return try {
            val gson = Gson()
            val taskGraph = gson.fromJson(options.taskGraph, Map::class.java) as? Map<*, *>

            if (taskGraph == null) {
                log.warn("Task graph is null, using all available tasks")
                options.tasks.keys.toList()
            } else {
                // Extract task IDs from the "tasks" field in the task graph
                val tasks = taskGraph["tasks"] as? Map<*, *>
                if (tasks != null) {
                    tasks.keys.map { it.toString() }.toList()
                } else {
                    log.warn("No tasks field in task graph, using all available tasks")
                    options.tasks.keys.toList()
                }
            }
        } catch (e: Exception) {
            log.warn("Failed to parse task graph: ${e.message}, using all available tasks")
            options.tasks.keys.toList()
        }
    }

    private fun buildTargets(task: MavenBatchTask): List<String> {
        val targets = mutableListOf<String>()

        // Add Nx Maven apply goal before user goals
        targets.add("dev.nx.maven:nx-maven-plugin:apply")

        // Add user-specified goals
        targets.addAll(task.goals)

        // Add Nx Maven record goal after user goals
        targets.add("dev.nx.maven:nx-maven-plugin:record")

        return targets
    }

    private fun createInvocationRequest(taskIds: List<String>): InvocationRequest {
        val request = DefaultInvocationRequest()
        request.baseDirectory = File(options.workspaceRoot)

        request.goals = mutableListOf()
        // Collect all goals from tasks (with Nx wrapper goals)
        for (taskId in taskIds) {
            val task = options.tasks[taskId] ?: continue
            request.projects = listOf(task.project)
            val targets = buildTargets(task)
            request.goals.addAll(targets)
            log.debug("Added targets from task $taskId: ${targets.joinToString(", ")}")
        }

      request.isRecursive = false

        log.info("Executing ${request.goals.joinToString(", ")} goals for ${request.projects.joinToString(", ")}")

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
