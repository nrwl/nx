package dev.nx.maven.adapter.maven3

import org.apache.maven.cli.event.ExecutionEventLogger
import org.apache.maven.execution.ExecutionEvent

/**
 * Execution listener for Maven 3 batch builds.
 * Mirrors Maven 4's BatchExecutionListener for consistent output.
 *
 * Suppresses verbose Maven output since the batch runner provides its own summary.
 */
class BatchExecutionListener : ExecutionEventLogger() {

    companion object {
        // Track current project across invocations to avoid duplicate "Building" headers
        @Volatile
        private var currentProjectId: String? = null
    }

    override fun projectDiscoveryStarted(event: ExecutionEvent) {
        // No-op - suppress "Scanning for projects" since graph is cached
    }

    override fun projectStarted(event: ExecutionEvent) {
        // Only print "Building" header if project has changed
        val projectId = "${event.project?.groupId}:${event.project?.artifactId}"
        if (projectId != currentProjectId) {
            currentProjectId = projectId
            super.projectStarted(event)
        }
    }

    override fun sessionEnded(event: ExecutionEvent) {
        // No-op - suppress "Total time" and other session end messages
        // The batch runner provides its own summary with timing for all tasks
    }

    // Note: mojoStarted is NOT overridden - we let the parent class handle it
    // This matches Maven 4's BatchExecutionListener behavior
}
