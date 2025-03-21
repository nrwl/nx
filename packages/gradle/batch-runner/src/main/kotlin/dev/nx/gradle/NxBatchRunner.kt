package dev.nx.gradle

import com.google.gson.Gson
import org.gradle.tooling.GradleConnector
import org.gradle.tooling.BuildLauncher
import org.gradle.tooling.ProjectConnection
import org.gradle.tooling.events.OperationType
import org.gradle.tooling.events.ProgressEvent
import org.gradle.tooling.events.task.TaskFinishEvent
import org.gradle.tooling.events.task.TaskSuccessResult
import org.gradle.tooling.events.task.TaskFailureResult
import java.io.ByteArrayOutputStream
import java.io.File
import kotlin.system.exitProcess
import java.util.logging.Logger

val logger: Logger = Logger.getLogger("NxBatchRunner")

data class NxBatchOptions(
        val workspaceRoot: String,
        val taskNames: List<String>,
        val args: String,
        val quiet: Boolean
)

fun main(args: Array<String>) {
    val options = parseArgs(args)
    configureLogger(options.quiet)

    if (options.workspaceRoot.isBlank()) {
        logger.severe("❌ Missing required arguments --workspaceRoot")
        exitProcess(1)
    } else if (options.taskNames.isEmpty()) {
        logger.severe("❌ Missing required arguments --taskNames")
        exitProcess(1)
    }

    logger.info("⚙️ Running NxBatchRunner")
    logger.info("  Workspace: ${options.workspaceRoot}")
    logger.info("  Tasks: ${options.taskNames}")
    logger.info("  Extra Args: ${options.args}")
    logger.info("  Quiet: ${options.quiet}")

    val connection = GradleConnector.newConnector()
            .forProjectDirectory(File(options.workspaceRoot))
            .connect()

    connection.use { connection ->
        val results = runTasksInParallel(connection, options.taskNames, options.args)

        val reportJson = Gson().toJson(results)
        println(reportJson)
    }
}

fun parseArgs(args: Array<String>): NxBatchOptions {
    val argMap = mutableMapOf<String, String>()

    args.forEach {
        when {
            it.startsWith("--") && it.contains("=") -> {
                val (key, value) = it.split("=", limit = 2)
                argMap[key] = value
            }
            it.startsWith("--") -> {
                // Flag-style arguments like --quiet (no = sign)
                argMap[it] = "true"
            }
        }
    }

    return NxBatchOptions(
            workspaceRoot = argMap["--workspaceRoot"] ?: "",
            taskNames = argMap["--taskNames"]?.split(",")?.map { it.trim() } ?: emptyList(),
            args = argMap["--args"] ?: "",
            quiet = argMap["--quiet"]?.toBoolean() ?: false
    )
}

fun configureLogger(quiet: Boolean) {
    if (quiet) {
        logger.setLevel(java.util.logging.Level.OFF)
        logger.useParentHandlers = false
        logger.handlers.forEach { it.level = java.util.logging.Level.OFF }
    } else {
        logger.setLevel(java.util.logging.Level.INFO)
    }
}

data class TaskResult(
        val success: Boolean,
        val startTime: Long,
        val endTime: Long,
        var terminalOutput: String
)

fun runTasksInParallel(connection: ProjectConnection, taskNames: List<String>, additionalArgs: String): Map<String, TaskResult> {
    logger.info("▶️ Running tasks in parallel: ${taskNames.joinToString(", ")}")

    val buildLauncher: BuildLauncher = connection.newBuild()

    val outputStream = ByteArrayOutputStream()
    val errorStream = ByteArrayOutputStream()

    val args = buildList {
        add("--continue")
        add("--parallel")
        addAll(additionalArgs.split(" ").filter { it.isNotEmpty() })
    }

    buildLauncher.forTasks(*taskNames.toTypedArray())
    buildLauncher.withArguments(args)

    buildLauncher.setStandardOutput(outputStream)
    buildLauncher.setStandardError(errorStream)

    val taskResults = mutableMapOf<String, TaskResult>()

    buildLauncher.addProgressListener({ event: ProgressEvent ->
        when (event) {
            is TaskFinishEvent -> {
                val taskPath = event.descriptor.taskPath
                if (taskNames.contains(taskPath)) {

                    val result = event.result
                    val success: Boolean
                    val errorMessage: String?

                    when (result) {
                        is TaskSuccessResult -> {
                            success = true
                            logger.info("✅ Task finished successfully: $taskPath")
                        }

                        is TaskFailureResult -> {
                            success = false
                            errorMessage = result.failures.joinToString("\n") { it.message ?: "Unknown error" }
                            logger.warning("❌ Task failed: $taskPath")
                            logger.warning("   Failures: $errorMessage")
                        }

                        else -> {
                            success = true
                            logger.warning("⚠️ Task finished with unknown result: $taskPath")
                        }
                    }

                    taskResults[taskPath] = TaskResult(
                            success = success,
                            startTime = result.startTime,
                            endTime = result.endTime,
                            terminalOutput = ""
                    )

                    val duration = result.endTime - result.startTime
                    logger.info("⏱️ Task '$taskPath' duration: ${duration}ms")
                }
            }
        }
    }, OperationType.TASK)

    val globalOutput = try {
        buildLauncher.run()
        buildTerminalOutput(outputStream, errorStream)
    } catch (e: Exception) {
        logger.info("💥 Exception while running tasks: ${e.message}")
        buildTerminalOutput(outputStream, errorStream) + "\n💥 Exception occurred: ${e.message}\n"
    } finally {
        outputStream.close()
        errorStream.close()
    }

    taskResults.values.forEach {
        it.terminalOutput = globalOutput
    }

    return taskResults
}

fun buildTerminalOutput(stdOut: ByteArrayOutputStream, stdErr: ByteArrayOutputStream): String {
    val output = stdOut.toString("UTF-8")
    val errorOutput = stdErr.toString("UTF-8")

    val builder = StringBuilder()
    if (output.isNotBlank()) {
        builder.append(output).append("\n")
    }
    if (errorOutput.isNotBlank()) {
        builder.append(errorOutput)
    }
    return builder.toString()
}
