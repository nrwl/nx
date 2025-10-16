package dev.nx.maven.utils

import org.slf4j.LoggerFactory
import java.io.File

/**
 * Singleton service that caches Maven command detection to avoid expensive process execution
 * and file system checks on every project analysis.
 */
object MavenCommandResolver {
    private val log = LoggerFactory.getLogger(MavenCommandResolver::class.java)

    @Volatile
    private var cachedCommand: String? = null

    /**
     * Gets the best Maven executable with caching: mvnd > mvnw > mvn
     */
    fun getMavenCommand(workspaceRoot: File): String {
        // Return cached result if workspace root hasn't changed
        if (cachedCommand != null) {
            log.debug("Using cached Maven command: $cachedCommand")
            return cachedCommand!!
        }

        log.info("Detecting Maven command for workspace: $workspaceRoot")
        val startTime = System.currentTimeMillis()

        cachedCommand = detectMavenCommand(workspaceRoot)

        val detectionTime = System.currentTimeMillis() - startTime
        log.info("Maven command detection completed: '$cachedCommand' in ${detectionTime}ms")

        return cachedCommand as String
    }

    private fun detectMavenCommand(workspaceRoot: File): String {
        // First priority: Check for Maven Daemon
//        try {
//            val mvndStart = System.currentTimeMillis()
//            val process = ProcessBuilder("mvnd", "--version")
//                .redirectOutput(ProcessBuilder.Redirect.PIPE)
//                .redirectError(ProcessBuilder.Redirect.PIPE)
//                .start()
//            val exitCode = process.waitFor()
//            val mvndTime = System.currentTimeMillis() - mvndStart
//            log.debug("mvnd detection took ${mvndTime}ms")
//
//            if (exitCode == 0) {
//                log.info("Found mvnd (Maven Daemon)")
//                return "mvnd"
//            }
//        } catch (e: Exception) {
//            log.debug("mvnd not available: ${e.message}")
//        }

        // Second priority: Check for Maven wrapper
        val mvnwStart = System.currentTimeMillis()
        val mvnwFile = File(workspaceRoot, "mvnw")
        val mvnwTime = System.currentTimeMillis() - mvnwStart
        log.debug("mvnw file check took ${mvnwTime}ms")

        if (mvnwFile.exists() && mvnwFile.canExecute()) {
            log.info("Found Maven wrapper: ./mvnw")
            return "./mvnw"
        }

        log.info("Falling back to system Maven: mvn")
        return "mvn"
    }
}
