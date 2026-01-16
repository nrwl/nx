package dev.nx.maven.runner

import org.slf4j.LoggerFactory
import java.io.File

/**
 * Factory for creating the best available Maven executor.
 *
 * Attempts to detect Maven version and create the most optimized executor:
 * - Maven 4.x: Creates ResidentMavenExecutor (uses official Maven 4.x APIs)
 * - Maven 3.9.x: Falls back to ProcessBasedMavenExecutor (subprocess execution)
 *
 * This provides version-agnostic executor creation that optimizes for available runtime.
 */
object MavenExecutorFactory {
    private val log = LoggerFactory.getLogger(MavenExecutorFactory::class.java)

    /**
     * Create a MavenExecutor suitable for the given Maven version.
     *
     * Strategy:
     * 1. Try ResidentMavenExecutor (Maven 4.x optimized, ~75% faster via context caching)
     * 2. Fall back to ProcessBasedMavenExecutor (Maven 3.9.x compatible, reliable)
     *
     * ResidentMavenExecutor:
     * - Uses Maven 4.x's official ResidentMavenInvoker from maven-cli
     * - Keeps Maven resident in memory across executions
     * - Caches entire Maven context (DI container, project models, services)
     * - Enables context-based caching (4-16ms per cached task)
     * - Requires Maven 4.x at runtime with maven-cli available
     *
     * ProcessBasedMavenExecutor:
     * - Subprocess execution via ProcessBuilder
     * - Works with both Maven 4.x and 3.9.x
     * - More reliable but slower (~35-50ms per task)
     * - No component initialization complexity
     *
     * @param workspaceRoot The Maven workspace root directory
     * @param mavenVersion The detected Maven version (e.g., "4.0.0", "3.9.9")
     * @return Optimized MavenExecutor for the given Maven version
     */
    fun create(
        workspaceRoot: File,
        mavenHome: File?,
        mavenVersion: String?
    ): MavenExecutor {
        log.debug("Creating executor for Maven version: $mavenVersion")

        // Decide executor based on detected Maven version
        val isMaven4 = mavenVersion?.startsWith("4") == true

        if (isMaven4) {
            // Maven 4.x: Use ResidentMavenExecutor for batch performance (~75% faster)
            log.debug("🚀 Maven 4.x detected - attempting ResidentMavenExecutor (optimized batch executor)...")
            return try {
                val executor = ResidentMavenExecutor(workspaceRoot, mavenHome)
                log.debug("✅ ResidentMavenExecutor created (Maven 4.x ResidentMavenInvoker available)")
                log.debug("   Maven version: $mavenVersion")
                executor
            } catch (e: Exception) {
                // Maven 4.x components not available, fall back to subprocess approach
                log.warn("⚠️  Maven 4.x ResidentMavenInvoker failed to initialize")
                log.warn("   Error: ${e.javaClass.simpleName}: ${e.message}")
                log.warn("   Falling back to ProcessBasedMavenExecutor for compatibility")
                ProcessBasedMavenExecutor(workspaceRoot)
            }
        } else {
            // Maven 3.x: Use ProcessBasedMavenExecutor for compatibility
            log.warn("📦 Maven 3.x detected ($mavenVersion) - using ProcessBasedMavenExecutor")
            log.debug("   Note: Using subprocess execution for compatibility")
            return ProcessBasedMavenExecutor(workspaceRoot)
        }
    }
}
