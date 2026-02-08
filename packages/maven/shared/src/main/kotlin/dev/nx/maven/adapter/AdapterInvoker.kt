package dev.nx.maven.adapter

import java.io.File
import java.io.OutputStream

/**
 * Interface for Maven version-specific adapters.
 *
 * This interface is in nx-maven-shared so both batch-runner and adapters can access it.
 * batch-runner includes it in its shaded JAR (not excluded like dev.nx.maven.shared.*).
 * ClassRealm's parent classloader delegation allows adapters to implement this interface.
 */
interface AdapterInvoker : AutoCloseable {

    /**
     * Execute Maven with the given arguments.
     *
     * @param args Maven CLI arguments (goals and options)
     * @param workingDir Working directory for Maven execution
     * @param stdout Output stream for stdout
     * @param stderr Output stream for stderr
     * @return Exit code (0 for success)
     */
    fun invoke(
        args: List<String>,
        workingDir: File,
        stdout: OutputStream,
        stderr: OutputStream
    ): Int

    /**
     * Record build states for the specified projects.
     * Called after batch execution to save state for future runs.
     *
     * @param projectSelectors Project selectors (e.g., "groupId:artifactId")
     */
    fun recordBuildStates(projectSelectors: Set<String>)
}
