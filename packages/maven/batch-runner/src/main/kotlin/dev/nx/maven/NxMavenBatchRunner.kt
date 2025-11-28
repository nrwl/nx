package dev.nx.maven

import com.google.gson.Gson
import dev.nx.maven.cli.ArgParser
import dev.nx.maven.runner.MavenInvokerRunner
import org.slf4j.LoggerFactory
import java.io.File
import kotlin.system.exitProcess

// Configure logging BEFORE any logger is created
// Maven 4 uses "maven.logger.*" properties (not "org.slf4j.simpleLogger.*")
private val loggingConfigured = run {
    // Maven 4 property names
    System.setProperty("maven.logger.showThreadName", "false")
    System.setProperty("maven.logger.showDateTime", "false")
    System.setProperty("maven.logger.showLogName", "false")
    System.setProperty("maven.logger.levelInBrackets", "true")
    System.setProperty("maven.logger.defaultLogLevel", "info")
    // Enable colored output (jansi.force needed when stdout isn't a TTY)
    System.setProperty("style.color", "always")
    System.setProperty("jansi.force", "true")
    true
}

private val log = LoggerFactory.getLogger("NxMavenBatchRunner")
private val gson = Gson()

fun printSummary(successCount: Int, failureCount: Int, skippedCount: Int, durationMs: Long) {
  val durationSec = String.format("%.2f", durationMs / 1000.0)
  val total = successCount + failureCount + skippedCount

  log.info("Nx Maven Summary")
  log.info("  ✅ Succeeded: $successCount")
  log.info("  ❌ Failed:    $failureCount")
  log.info("  ⏭️ Skipped:   $skippedCount")
  log.info("  📦 Total:     $total")
  log.info("  ⏱️ Duration:  ${durationSec}s")
}

fun main(args: Array<String>) {
    try {
        // Parse arguments
        val options = ArgParser.parseArgs(args)

        // Get workspace root from options
        val workspaceRoot = File(options.workspaceRoot)

        if (!workspaceRoot.exists()) {
            log.error("❌ Nx workspace not found at: ${workspaceRoot.absolutePath}")
            exitProcess(1)
        }

        if (options.tasks.isEmpty()) {
            log.error("❌ Missing required argument: --tasks")
            exitProcess(1)
        }

        val startTime = System.currentTimeMillis()

        log.info("🚀 Starting Nx Maven batch execution")
        log.debug("   Workspace: ${workspaceRoot.absolutePath}")
        log.debug("   Tasks: ${options.tasks.size}")
        log.debug("   Verbose: ${options.verbose}")

        // Run batch execution
        val runner = MavenInvokerRunner(workspaceRoot, options)

        val results = runner.runBatch()

        // Output results as JSON to specified file
        val jsonResults = results.mapValues { (_, result) ->
            mapOf(
                "success" to result.success,
                "terminalOutput" to result.terminalOutput,
                "startTime" to result.startTime,
                "endTime" to result.endTime
            )
        }

        val resultsJson = gson.toJson(jsonResults)

        // Output JSON to stdout for parent process to capture
        // Log to stderr to avoid mixing with JSON output
        log.debug("📝 Results ready, outputting JSON to stdout")

        // Output JSON result on stdout - must be valid JSON for parent process
        println(resultsJson)
        System.out.flush()

        // Summary
        val successCount = results.count { it.value.success }
        val failureCount = results.size - successCount
        val skippedCount = options.tasks.size - results.size

        // Log execution time
        val endTime = System.currentTimeMillis()
        val duration = endTime - startTime

        // Print failed task outputs at the end for easy visibility
        val failedResults = results.filter { !it.value.success }
        if (failedResults.isNotEmpty()) {
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

        printSummary(successCount, failureCount, skippedCount, duration)

        // Exit with appropriate code
        val hasFailures = results.any { !it.value.success }
        val exitCode = if (hasFailures) 1 else 0

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
