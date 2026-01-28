package dev.nx.maven.runner

import org.slf4j.LoggerFactory
import java.io.File

/**
 * Factory for creating the best available Maven executor.
 *
 * Attempts to detect Maven version and create ResidentMavenExecutor which
 * supports both Maven 3.x and 4.x via runtime class loading.
 *
 * Fallback: ProcessBasedMavenExecutor (subprocess execution)
 */
object MavenExecutorFactory {
    private val log = LoggerFactory.getLogger(MavenExecutorFactory::class.java)

    fun create(
        workspaceRoot: File,
        mavenHome: File?,
        mavenVersion: String?
    ): MavenExecutor {
        if (mavenHome == null) {
            log.warn("MAVEN_HOME not found - using slower subprocess execution")
            return ProcessBasedMavenExecutor(workspaceRoot)
        }

        val mavenMajorVersion = mavenVersion?.substringBefore(".")
            ?: MavenClassRealm.detectMavenMajorVersion(mavenHome)

        return try {
            ResidentMavenExecutor(workspaceRoot, mavenHome, mavenMajorVersion)
        } catch (e: Exception) {
            log.warn("ResidentMavenExecutor failed: ${e.message}, falling back to subprocess execution")
            log.debug("ResidentMavenExecutor exception details", e)
            ProcessBasedMavenExecutor(workspaceRoot)
        }
    }
}
