package dev.nx.maven.adapter.maven3

import org.apache.maven.cli.event.ExecutionEventLogger
import org.apache.maven.execution.ExecutionEvent
import org.slf4j.LoggerFactory

/**
 * Execution listener for batch builds that extends Maven's ExecutionEventLogger.
 *
 * This listener uses SLF4J logging natively (via the parent ExecutionEventLogger).
 * The batch runner redirects System.out to capture the output from slf4j-simple.
 */
class BatchExecutionListener : ExecutionEventLogger() {
    companion object {
        @Volatile
        private var currentProjectId: String? = null
    }

    override fun projectDiscoveryStarted(event: ExecutionEvent) {
        // No-op - suppress "Scanning for projects" since the graph is cached
    }

    override fun projectStarted(event: ExecutionEvent) {
        val project = event.project ?: return
        val projectId = "${project.groupId}:${project.artifactId}"
        if (projectId != currentProjectId) {
            currentProjectId = projectId
            super.projectStarted(event)
        }
    }

    override fun sessionEnded(event: ExecutionEvent) {
        // No-op - suppress session end messages (Total time, etc.)
        // The batch runner provides its own summary with timing for all tasks
    }
}
