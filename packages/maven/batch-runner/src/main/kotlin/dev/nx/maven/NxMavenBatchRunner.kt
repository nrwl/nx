package dev.nx.maven

import dev.nx.maven.cli.ArgParser
import dev.nx.maven.data.TaskResult
import dev.nx.maven.runner.MavenInvokerRunner
import org.slf4j.LoggerFactory
import java.io.File
import kotlin.system.exitProcess
import kotlin.time.Duration.Companion.milliseconds

// Configure logging BEFORE any logger is created
// SLF4J SimpleLogger uses "org.slf4j.simpleLogger.*" properties
private fun configureLogging(verbose: Boolean) {
    val logLevel = if (verbose) "debug" else "info"
    // SLF4J SimpleLogger properties
    System.setProperty("org.slf4j.simpleLogger.showThreadName", "false")
    System.setProperty("org.slf4j.simpleLogger.showDateTime", "false")
    System.setProperty("org.slf4j.simpleLogger.showLogName", "false")
    System.setProperty("org.slf4j.simpleLogger.levelInBrackets", "true")
    System.setProperty("org.slf4j.simpleLogger.defaultLogLevel", logLevel)
    // Log to stdout (stderr is used for NX_RESULT streaming)
    System.setProperty("org.slf4j.simpleLogger.logFile", "System.out")
    // Enable colored output (jansi.force needed when stdout isn't a TTY)
    System.setProperty("style.color", "always")
    System.setProperty("jansi.force", "true")
}

// Lazy logger - created after logging is configured
private val log by lazy { LoggerFactory.getLogger("NxMavenBatchRunner") }

fun main(args: Array<String>) {
    // Check for --verbose BEFORE creating any loggers
    val verbose = args.contains("--verbose")
    configureLogging(verbose)

    try {
        // Parse arguments (logger is created here on first use)
        val options = ArgParser.parseArgs(args)

        // Get workspace root from options
        val workspaceRoot = File(options.workspaceRoot)

        val taskGraph = options.taskGraph
        if (taskGraph == null || taskGraph.tasks.isEmpty()) {
            log.error("❌ No tasks to execute")
            exitProcess(1)
        }
        val taskCount = taskGraph.tasks.size

        log.info("🚀 Starting Nx Maven batch execution ($taskCount tasks)")
        log.debug("   Workspace: ${workspaceRoot.absolutePath}")
        log.debug("   Verbose: ${options.verbose}")

        val startTime = System.currentTimeMillis()

        // Run batch execution
        val runner = MavenInvokerRunner(workspaceRoot, options)
        val results = runner.runBatch()

        val endTime = System.currentTimeMillis()

        // Summary
        val successCount = results.count { it.value.success }
        val failureCount = results.size - successCount
        val skippedCount = taskCount - results.size

        printFailedTasks(results)
        printSummary(successCount, failureCount, skippedCount, endTime - startTime)

        // Exit with appropriate code
        val exitCode = if (failureCount > 0) 1 else 0

        // Ensure stderr is flushed before exiting
        System.err.flush()
        System.out.flush()

        // IMPORTANT: The Maven executor may have hanging threads or resource locks
        // that prevent normal JVM exit. Use Runtime.halt() to force termination.
        // This bypasses waitForNonDaemonThreads() and ensures immediate exit.
        log.debug("Forcing JVM termination with exit code: $exitCode")
        Runtime.getRuntime().halt(exitCode)

    } catch (e: Exception) {
        log.error("💥 Fatal error: ${e.message}", e)

        // Ensure stderr is flushed before exiting
        System.err.flush()
        System.out.flush()

        // Force JVM termination to avoid hanging on resources
        Runtime.getRuntime().halt(1)
    }
}

private fun printFailedTasks(results: Map<String, TaskResult>) {
    val failedResults = results.filter { !it.value.success }
    if (failedResults.isEmpty()) return

    log.info("")
    log.info("═".repeat(80))
    log.info("❌ FAILED TASKS")
    log.info("═".repeat(80))
    failedResults.forEach { (taskId, result) ->
        log.info("")
        log.info("Task: $taskId")
        log.info("-".repeat(40))
        if (result.terminalOutput.isNotBlank()) {
            log.info(result.terminalOutput)
        }
    }
    log.info("═".repeat(80))
    log.info("")
}

private fun printSummary(successCount: Int, failureCount: Int, skippedCount: Int, durationMs: Long) {
    val duration = durationMs.milliseconds
    val total = successCount + failureCount + skippedCount

    log.info("Nx Maven Summary")
    log.info("  ✅ Succeeded: $successCount")
    log.info("  ❌ Failed:    $failureCount")
    log.info("  ⏭️ Skipped:   $skippedCount")
    log.info("  📦 Total:     $total")
    log.info("  ⏱️ Duration:  $duration")
}
