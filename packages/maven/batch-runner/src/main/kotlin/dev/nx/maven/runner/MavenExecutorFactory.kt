package dev.nx.maven.runner

import org.slf4j.LoggerFactory
import java.io.File

/**
 * Factory for creating the best available Maven executor.
 *
 * Attempts to detect Maven version and create the most optimized executor:
 * - Maven 4.x: Creates ResidentMavenExecutor (uses reflection to load Maven classes)
 * - Maven 3.x: Creates EmbeddedMaven3Executor (uses reflection to load Maven classes)
 * - Fallback: ProcessBasedMavenExecutor (subprocess execution)
 *
 * Key design: NO compile-time Maven dependencies!
 * - Maven classes are loaded from MAVEN_HOME at runtime via MavenClassRealm
 * - Adapter classes are embedded as JAR resources and loaded into the ClassRealm
 * - All Maven interactions happen via reflection
 */
object MavenExecutorFactory {
    private val log = LoggerFactory.getLogger(MavenExecutorFactory::class.java)

    /**
     * Create a MavenExecutor suitable for the given Maven version.
     *
     * Strategy:
     * 1. If Maven home is available, try ResidentMavenExecutor (loads Maven + adapters at runtime)
     * 2. Fall back to ProcessBasedMavenExecutor (subprocess execution for any Maven version)
     *
     * @param workspaceRoot The Maven workspace root directory
     * @param mavenHome The Maven installation directory (optional)
     * @param mavenVersion The detected Maven version (e.g., "4.0.0", "3.9.9")
     * @return Optimized MavenExecutor for the given Maven version
     */
    fun create(
        workspaceRoot: File,
        mavenHome: File?,
        mavenVersion: String?
    ): MavenExecutor {
        log.debug("Creating executor - workspaceRoot: $workspaceRoot, mavenHome: $mavenHome, mavenVersion: $mavenVersion")

        // If no Maven home, fall back to subprocess
        if (mavenHome == null) {
            log.debug("No mavenHome - using ProcessBasedMavenExecutor")
            return ProcessBasedMavenExecutor(workspaceRoot)
        }

        // Detect Maven major version
        val mavenMajorVersion = mavenVersion?.substringBefore(".")
            ?: MavenClassRealm.detectMavenMajorVersion(mavenHome)

        val isMaven4 = mavenMajorVersion == "4"
        log.debug("Detected Maven major version: $mavenMajorVersion (isMaven4: $isMaven4)")

        if (isMaven4) {
            // Maven 4.x: Use ResidentMavenExecutor for batch performance
            return try {
                val executor = ResidentMavenExecutor(workspaceRoot, mavenHome, "4")
                log.debug("ResidentMavenExecutor created successfully")
                executor
            } catch (e: Exception) {
                log.warn("ResidentMavenExecutor failed: ${e.javaClass.simpleName}: ${e.message}, falling back to ProcessBasedMavenExecutor")
                log.debug("ResidentMavenExecutor exception details", e)
                ProcessBasedMavenExecutor(workspaceRoot)
            }
        } else {
            // Maven 3.x: Use EmbeddedMaven3Executor for batch performance with caching
            return try {
                val executor = EmbeddedMaven3Executor(workspaceRoot, mavenHome)
                log.debug("EmbeddedMaven3Executor created successfully")
                executor
            } catch (e: Exception) {
                log.warn("EmbeddedMaven3Executor failed: ${e.javaClass.simpleName}: ${e.message}, falling back to ProcessBasedMavenExecutor")
                log.debug("EmbeddedMaven3Executor exception details", e)
                ProcessBasedMavenExecutor(workspaceRoot)
            }
        }
    }
}
