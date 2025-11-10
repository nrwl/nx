package dev.nx.maven.runner

import org.slf4j.LoggerFactory
import java.io.ByteArrayOutputStream
import java.io.File

/**
 * Fallback Maven executor for environments where Maven 4.x components aren't available.
 *
 * This executor uses ProcessBuilder to invoke Maven as a subprocess.
 * Used when ResidentMavenExecutor can't initialize (e.g., Maven 3.9.x environments).
 *
 * Limitations:
 * - No project caching (each task is independent)
 * - Slightly more overhead than session-based execution
 * - But compatible with Maven 3.9.x and other Maven versions
 */
class ProcessBasedMavenExecutor(private val workspaceRoot: File) : MavenExecutor {
    private val log = LoggerFactory.getLogger(ProcessBasedMavenExecutor::class.java)

    /**
     * Execute Maven by invoking the `mvn` command as a subprocess.
     */
    override fun execute(
        goals: List<String>,
        arguments: List<String>,
        workingDir: File,
        outputStream: ByteArrayOutputStream
    ): Int {
        val startTime = System.currentTimeMillis()

        return try {
            // Build the command: mvn [arguments] [goals]
            val command = mutableListOf("mvn")
            command.addAll(arguments)
            command.addAll(goals)

            log.debug("Executing: ${command.joinToString(" ")}")

            // Create process builder
            val processBuilder = ProcessBuilder(command)
            processBuilder.directory(workingDir)
            processBuilder.redirectErrorStream(true)

            // Start process
            val process = processBuilder.start()

            // Capture output
            val output = process.inputStream.readBytes()
            outputStream.write(output)

            // Wait for completion
            val exitCode = process.waitFor()

            val duration = System.currentTimeMillis() - startTime
            log.info("Maven execution completed in ${duration}ms with exit code: $exitCode")

            exitCode
        } catch (e: Exception) {
            log.error("Failed to execute Maven via ProcessBuilder: ${e.message}", e)
            1
        }
    }

    override fun shutdown() {
        log.info("ProcessBasedMavenExecutor shutdown complete")
    }
}
