package dev.nx.maven

import com.google.gson.Gson
import dev.nx.maven.cli.ArgParser
import dev.nx.maven.runner.MavenInvokerRunner
import org.slf4j.LoggerFactory
import java.io.File
import kotlin.system.exitProcess

private val log = LoggerFactory.getLogger("NxMavenBatchRunner")
private val gson = Gson()

fun main(args: Array<String>) {
    try {
        // Parse arguments
        val options = ArgParser.parseArgs(args)

        // Set workspaceRoot to ~/projects/nx4 (the Nx monorepo)
        val workspaceRoot = File(System.getProperty("user.home"), "projects/nx4")

        if (!workspaceRoot.exists()) {
            log.error("❌ Nx workspace not found at: ${workspaceRoot.absolutePath}")
            exitProcess(1)
        }

        if (options.tasks.isEmpty()) {
            log.error("❌ Missing required argument: --tasks")
            exitProcess(1)
        }

        log.info("🚀 Starting Maven batch execution")
        log.info("   Workspace: ${workspaceRoot.absolutePath}")
        log.info("   Tasks: ${options.tasks.size}")
        log.info("   Quiet: ${options.quiet}, Verbose: ${options.verbose}")

        // Run batch execution
        val runner = MavenInvokerRunner(workspaceRoot, options)

        // Register shutdown hook for graceful SIGINT handling
        Runtime.getRuntime().addShutdownHook(Thread {
            log.info("🛑 Received SIGINT, initiating graceful shutdown...")
            runner.requestShutdown()
        })

        val results = runner.runBatch()

        // Output results as JSON to specified file
        val jsonResults = results.mapValues { (_, result) ->
            mapOf(
                "success" to result.success,
                "terminalOutput" to result.terminalOutput
            )
        }

        val resultsJson = gson.toJson(jsonResults)

        // Output JSON to stdout for parent process to capture
        // Log to stderr to avoid mixing with JSON output
        System.err.println("📝 Results ready, outputting JSON to stdout")
        System.err.flush()

        // Output JSON result on stdout - must be valid JSON for parent process
        println(resultsJson)
        System.out.flush()

        // Summary
        val successCount = results.count { it.value.success }
        val failureCount = results.size - successCount

        log.info("📊 Summary: ✅ $successCount succeeded, ❌ $failureCount failed")

        // Exit with appropriate code
        val hasFailures = results.any { !it.value.success }
        exitProcess(if (hasFailures) 1 else 0)

    } catch (e: Exception) {
        log.error("💥 Fatal error: ${e.message}", e)
        exitProcess(1)
    }
}
