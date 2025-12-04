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
class ProcessBasedMavenExecutor(workspaceRoot: File) : MavenExecutor {
    private val log = LoggerFactory.getLogger(ProcessBasedMavenExecutor::class.java)
    private val mavenExecutable: String = MavenHomeDiscovery(workspaceRoot).detectMavenExecutable()

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
            // Build the command: [maven-executable] [arguments] [goals]
            val command = mutableListOf(mavenExecutable)
            command.add("dev.nx.maven:nx-maven-plugin:apply")
            command.addAll(goals)
            command.add("dev.nx.maven:nx-maven-plugin:record")
            command.addAll(arguments)

            log.info("Executing in ${workingDir.absolutePath}: ${command.joinToString(" ")}")

            // Create process builder
            val processBuilder = ProcessBuilder(command)
            processBuilder.directory(workingDir)
            processBuilder.redirectErrorStream(true)

            // Start process
            val process = processBuilder.start()

            // Stream output in real-time while also capturing for results
            val buffer = ByteArray(8192)
            var bytesRead: Int
            while (process.inputStream.read(buffer).also { bytesRead = it } != -1) {
                outputStream.write(buffer, 0, bytesRead)
                System.out.write(buffer, 0, bytesRead)
                System.out.flush()
            }

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
