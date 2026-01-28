package dev.nx.maven.runner

import java.io.ByteArrayOutputStream
import java.io.File

/**
 * Common interface for Maven executors.
 * Implementations may use different strategies (session-based, process-based, etc.)
 */
interface MavenExecutor {
    /**
     * Execute Maven with the given goals and arguments.
     *
     * @param goals Maven goals to execute
     * @param arguments Maven command-line arguments
     * @param workingDir Working directory for execution
     * @param outputStream Output stream for Maven output
     * @return Exit code (0 = success)
     */
    fun execute(
        goals: List<String>,
        arguments: List<String>,
        workingDir: File,
        outputStream: ByteArrayOutputStream = ByteArrayOutputStream()
    ): Int

    /**
     * Shutdown and cleanup.
     */
    fun shutdown()

    /**
     * Execute an action with the appropriate class loader context.
     * For resident executors, this sets the Thread Context ClassLoader.
     * For process-based executors, this is a no-op passthrough.
     */
    fun <T> withClassLoaderContext(action: () -> T): T = action()
}
