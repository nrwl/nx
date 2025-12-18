package dev.nx.maven.shared

import org.slf4j.LoggerFactory
import java.io.File

/**
 * Singleton service that caches Maven command detection to avoid expensive process execution
 * and file system checks on every project analysis.
 */
object MavenCommandResolver {
    private val log = LoggerFactory.getLogger(MavenCommandResolver::class.java)

    private const val MVND_COMMAND = "mvnd"
    private const val MVNW_COMMAND = "./mvnw"
    private const val MVN_COMMAND = "mvn"
    private const val MVNW_FILENAME = "mvnw"

    @Volatile
    private var cachedCommand: String? = null

    /**
     * Gets the best Maven executable with caching: mvnd > mvnw > mvn
     */
    fun getMavenCommand(workspaceRoot: File): String {
        cachedCommand?.let {
            log.debug("Using cached Maven command: $it")
            return it
        }

        log.info("Detecting Maven command for workspace: $workspaceRoot")
        val startTime = System.currentTimeMillis()

        cachedCommand = detectMavenCommand(workspaceRoot)

        val detectionTime = System.currentTimeMillis() - startTime
        log.info("Maven command detection completed: '$cachedCommand' in ${detectionTime}ms")

        return cachedCommand!!
    }

    private fun detectMavenCommand(workspaceRoot: File): String {
        // First priority: Check for Maven Daemon
        if (isMvndAvailable()) {
            log.info("Found mvnd (Maven Daemon)")
            return MVND_COMMAND
        }

        // Second priority: Check for Maven wrapper
        val mvnwFile = File(workspaceRoot, MVNW_FILENAME)
        if (mvnwFile.exists() && mvnwFile.canExecute()) {
            log.info("Found Maven wrapper: $MVNW_COMMAND")
            return MVNW_COMMAND
        }

        log.info("Falling back to system Maven: $MVN_COMMAND")
        return MVN_COMMAND
    }

    private fun isMvndAvailable(): Boolean {
        return try {
            val startTime = System.currentTimeMillis()
            val process = ProcessBuilder(MVND_COMMAND, "--version")
                .redirectOutput(ProcessBuilder.Redirect.PIPE)
                .redirectError(ProcessBuilder.Redirect.PIPE)
                .start()
            val exitCode = process.waitFor()
            val detectionTime = System.currentTimeMillis() - startTime
            log.debug("$MVND_COMMAND detection took ${detectionTime}ms")
            exitCode == 0
        } catch (e: Exception) {
            log.debug("$MVND_COMMAND not available: ${e.message}")
            false
        }
    }
}
