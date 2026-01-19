package dev.nx.maven.runner

import org.slf4j.LoggerFactory
import java.io.File

/**
 * Factory for creating the best available Maven executor.
 *
 * Attempts to detect Maven version and create the most optimized executor:
 * - Maven 4.x: Creates ReflectionMavenExecutor (uses reflection to load Maven classes)
 * - Maven 3.x: Falls back to ProcessBasedMavenExecutor (subprocess execution)
 *
 * Key design: NO compile-time Maven dependencies!
 * - Maven classes are loaded from MAVEN_HOME at runtime via MavenClassRealm
 * - Adapter classes (CachingResidentMavenInvoker, NxMaven, etc.) are embedded as resources
 *   and injected into the ClassRealm at runtime
 * - All Maven interactions happen via reflection
 */
object MavenExecutorFactory {
    private val log = LoggerFactory.getLogger(MavenExecutorFactory::class.java)

    /**
     * Create a MavenExecutor suitable for the given Maven version.
     *
     * Strategy:
     * 1. If Maven home is available, try ReflectionMavenExecutor (loads Maven + adapters at runtime)
     * 2. Fall back to ProcessBasedMavenExecutor (subprocess execution for any Maven version)
     *
     * ReflectionMavenExecutor (Maven 4.x optimized):
     * - Uses MavenClassRealm to load Maven JARs from MAVEN_HOME
     * - Injects pre-compiled adapter classes (NxMaven, CachingResidentMavenInvoker)
     * - Enables full graph caching via NxMaven
     * - Requires Maven 4.x at runtime
     *
     * ProcessBasedMavenExecutor:
     * - Subprocess execution via ProcessBuilder
     * - Works with both Maven 4.x and 3.9.x
     * - More reliable but slower (~35-50ms per task)
     * - No graph caching, no component initialization complexity
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
        System.err.println("[NX-REFLECTION] MavenExecutorFactory.create() called")
        System.err.println("[NX-REFLECTION]   workspaceRoot: $workspaceRoot")
        System.err.println("[NX-REFLECTION]   mavenHome: $mavenHome")
        System.err.println("[NX-REFLECTION]   mavenVersion: $mavenVersion")
        log.debug("Creating executor for Maven version: $mavenVersion")

        // If no Maven home, fall back to subprocess
        if (mavenHome == null) {
            System.err.println("[NX-REFLECTION] No mavenHome - using ProcessBasedMavenExecutor")
            return ProcessBasedMavenExecutor(workspaceRoot)
        }

        // Detect Maven major version
        val mavenMajorVersion = mavenVersion?.substringBefore(".")
            ?: MavenClassRealm.detectMavenMajorVersion(mavenHome)
        System.err.println("[NX-REFLECTION]   mavenMajorVersion: $mavenMajorVersion")

        val isMaven4 = mavenMajorVersion == "4"
        System.err.println("[NX-REFLECTION]   isMaven4: $isMaven4")

        if (isMaven4) {
            // Maven 4.x: Use ReflectionMavenExecutor for batch performance
            System.err.println("[NX-REFLECTION] Maven 4.x detected ($mavenVersion) - using ReflectionMavenExecutor")
            System.err.println("[NX-REFLECTION] Loading Maven classes from MAVEN_HOME at runtime (no bundled Maven)")
            return try {
                val executor = ReflectionMavenExecutor(workspaceRoot, mavenHome, "4")
                System.err.println("[NX-REFLECTION] ReflectionMavenExecutor created successfully!")
                executor
            } catch (e: Exception) {
                System.err.println("[NX-REFLECTION] ReflectionMavenExecutor failed: ${e.javaClass.simpleName}: ${e.message}")
                System.err.println("[NX-REFLECTION] Falling back to ProcessBasedMavenExecutor")
                e.printStackTrace(System.err)
                ProcessBasedMavenExecutor(workspaceRoot)
            }
        } else {
            // Maven 3.x: Use Maven3ReflectionExecutor for batch performance with caching
            System.err.println("[NX-REFLECTION] Maven 3.x detected ($mavenVersion) - using Maven3ReflectionExecutor")
            System.err.println("[NX-REFLECTION] Loading Maven classes from MAVEN_HOME at runtime (no bundled Maven)")
            return try {
                val executor = Maven3ReflectionExecutor(workspaceRoot, mavenHome)
                System.err.println("[NX-REFLECTION] Maven3ReflectionExecutor created successfully!")
                executor
            } catch (e: Exception) {
                System.err.println("[NX-REFLECTION] Maven3ReflectionExecutor failed: ${e.javaClass.simpleName}: ${e.message}")
                System.err.println("[NX-REFLECTION] Falling back to ProcessBasedMavenExecutor")
                e.printStackTrace(System.err)
                ProcessBasedMavenExecutor(workspaceRoot)
            }
        }
    }
}
